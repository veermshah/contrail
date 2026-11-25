import AsyncStorage from '@react-native-async-storage/async-storage';

import { addFlight, searchFlights, type FlightCandidate } from './flights';
import { getFlights } from './store';

const URL_KEY = 'contrail:calendar-url';
const SEEN_KEY = 'contrail:calendar-seen';

export type CalendarFlight = { uid: string; number: string; dateLocal: string; summary: string; startMs?: number; endMs?: number };

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

function startOf(dtstart: string): number | undefined {
  const m = dtstart.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : undefined;
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
    const startMs = startOf(field('DTSTART'));
    const endMs = startOf(field('DTEND'));
    if (number && dateLocal) out.push({ uid: field('UID') || `${number}-${dateLocal}`, number, dateLocal, summary, startMs, endMs });
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

const shiftDate = (d: string, days: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

/** Finds the leg whose scheduled departure matches the event start; falls back to the first result when times are unknown. */
async function findLeg(cf: CalendarFlight): Promise<FlightCandidate | null> {
  const dates = cf.startMs ? [cf.dateLocal, shiftDate(cf.dateLocal, -1), shiftDate(cf.dateLocal, 1)] : [cf.dateLocal];
  let fallback: FlightCandidate | null = null;
  for (const d of dates) {
    const results = await searchFlights(cf.number, d).catch(() => [] as FlightCandidate[]);
    const timed = results.filter((r) => r.departure.scheduledUtc);
    if (!cf.startMs || !timed.length) {
      fallback ??= d === cf.dateLocal ? (results[0] ?? null) : null;
      continue;
    }
    const best = timed
      .map((r) => ({ r, diff: Math.abs(Date.parse(r.departure.scheduledUtc!) - cf.startMs!) }))
      .sort((a, b) => a.diff - b.diff)[0];
    if (best.diff <= 3 * 3600e3) return best.r;
  }
  if (fallback && !fallback.departure.scheduledUtc && cf.startMs) {
    const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : undefined);
    return {
      ...fallback,
      departure: { ...fallback.departure, scheduledUtc: iso(cf.startMs) },
      arrival: { ...fallback.arrival, scheduledUtc: iso(cf.endMs) },
      status: 'Expected',
    };
  }
  return fallback;
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
    const key = `${cf.uid}|${cf.number}|${cf.dateLocal}|${cf.startMs ?? ''}`;
    if (seen.has(key)) continue;
    const match = await findLeg(cf);
    if (!match) continue;
    const before = getFlights().length;
    await addFlight({ ...match, notes: `From calendar: ${cf.summary}` });
    if (getFlights().length > before) added++;
    seen.add(key);
  }
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  return { found: flights.length, added };
}
