import AsyncStorage from '@react-native-async-storage/async-storage';

import { addFlight, searchFlights } from './flights';
import { getFlights } from './store';

const URL_KEY = 'contrail:calendar-url';
const SEEN_KEY = 'contrail:calendar-seen';

export type CalendarFlight = { uid: string; number: string; dateLocal: string; summary: string };

export const getCalendarUrl = () => AsyncStorage.getItem(URL_KEY);
export async function setCalendarUrl(url: string | null) {
  if (url && url.trim()) await AsyncStorage.setItem(URL_KEY, url.trim().replace(/^webcal:/i, 'https:'));
  else await AsyncStorage.removeItem(URL_KEY);
}

function unfold(ics: string) {
  return ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function unescape(v: string) {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
}

const FLIGHT_RE = /\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?(\d{1,4}[A-Z]?)\b/g;
const NOT_AIRLINE = new Set(['AM', 'PM', 'NO', 'OF', 'TO', 'ON', 'AT', 'IN', 'BY', 'ID', 'PO', 'US', 'UK', 'EU', 'TV', 'PA', 'CA', 'NY', 'TX']);

export function findFlightNumber(text: string): string | null {
  const t = text.toUpperCase();
  const paren = t.match(/\(([A-Z0-9]{2})\s?(\d{1,4}[A-Z]?)\)/);
  if (paren) return `${paren[1]}${paren[2]}`;
  if (!/FLIGHT|✈|DEPART|AIRLINE|AIRWAYS|BOARDING/.test(t)) return null;
  for (const m of t.matchAll(FLIGHT_RE)) {
    if (/^\d+$/.test(m[1]) || NOT_AIRLINE.has(m[1])) continue;
    return `${m[1]}${m[2]}`;
  }
  return null;
}

function dateOf(dtstart: string): string | null {
  const m = dtstart.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  if (!m[7]) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseFlights(ics: string): CalendarFlight[] {
  const out: CalendarFlight[] = [];
  for (const block of unfold(ics).split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const field = (name: string) => body.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, 'm'))?.[1]?.trim() ?? '';
    const summary = unescape(field('SUMMARY'));
    const number = findFlightNumber(`${summary} ${unescape(field('DESCRIPTION'))}`);
    const dateLocal = dateOf(field('DTSTART'));
    if (number && dateLocal) out.push({ uid: field('UID') || `${number}-${dateLocal}`, number, dateLocal, summary });
  }
  return out;
}

async function fetchText(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Calendar returned ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/** Imports upcoming flights from the saved calendar feed. Returns the number of flights added. */
export async function importFromCalendar(url?: string): Promise<{ found: number; added: number }> {
  const feed = url ?? (await getCalendarUrl());
  if (!feed) return { found: 0, added: 0 };
  const ics = await fetchText(feed.replace(/^webcal:/i, 'https:'));
  if (!ics.includes('BEGIN:VCALENDAR')) throw new Error('That link is not an iCal (.ics) calendar.');
  const today = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 10);
  const flights = parseFlights(ics).filter((f) => f.dateLocal >= today);
  const seen = new Set<string>(JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) ?? '[]'));
  let added = 0;
  for (const cf of flights) {
    if (seen.has(cf.uid)) continue;
    const exists = getFlights().some((f) => f.dateLocal === cf.dateLocal && f.number.replace(/\s/g, '') === cf.number);
    if (!exists) {
      const [match] = await searchFlights(cf.number, cf.dateLocal).catch(() => []);
      if (!match) continue;
      await addFlight({ ...match, notes: `From calendar: ${cf.summary}` });
      added++;
    }
    seen.add(cf.uid);
  }
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  return { found: flights.length, added };
}
