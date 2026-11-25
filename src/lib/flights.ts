import { routeByCallsign } from './api/adsbdb';
import { flightsByNumber, flightsByReg } from './api/aerodatabox';
import { liveByCallsign, liveByHex, liveByReg } from './api/live';
import { bestTime, delayMinutes, fmtTime } from './format';
import { distanceKm } from './geo';
import { notifyNow, scheduleReminders } from './notifications';
import { getApiKey, getPrefs } from './settings';
import { getFlight, getFlights, upsertFlight } from './store';
import type { Airport, Flight, LivePosition } from './types';

export type FlightCandidate = Omit<Flight, 'id' | 'addedAt'>;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function withDistance<T extends FlightCandidate>(f: T): T {
  if (f.distanceKm) return f;
  const a = f.departure.airport, b = f.arrival.airport;
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return f;
  return { ...f, distanceKm: distanceKm({ latitude: a.lat, longitude: a.lon }, { latitude: b.lat, longitude: b.lon }) };
}

export async function searchFlights(number: string, dateLocal: string): Promise<FlightCandidate[]> {
  if (await getApiKey()) {
    const results = await flightsByNumber(number, dateLocal);
    if (results.length) {
      const route = results[0].callSign ? null : await routeByCallsign(number);
      return results.map((r) => withDistance({ ...r, callSign: r.callSign ?? route?.callSignIcao }));
    }
  }
  const route = await routeByCallsign(number);
  if (!route) return [];
  return [
    withDistance({
      number: route.callSignIata ?? number,
      callSign: route.callSignIcao,
      dateLocal,
      airline: route.airline,
      departure: { airport: route.origin },
      arrival: { airport: route.destination },
      status: 'Unknown',
      source: 'route',
    }),
  ];
}

export async function addFlight(c: FlightCandidate) {
  const dup = getFlights().find(
    (x) =>
      x.number === c.number &&
      x.dateLocal === c.dateLocal &&
      x.departure.airport.iata === c.departure.airport.iata &&
      (x.departure.scheduledUtc === c.departure.scheduledUtc || !x.departure.scheduledUtc || !c.departure.scheduledUtc)
  );
  if (dup && !dup.departure.scheduledUtc && c.departure.scheduledUtc) {
    const upgraded: Flight = {
      ...dup,
      ...c,
      departure: { ...c.departure, airport: mergeAirport(dup.departure.airport, c.departure.airport) },
      arrival: { ...c.arrival, airport: mergeAirport(dup.arrival.airport, c.arrival.airport) },
      id: dup.id,
      addedAt: dup.addedAt,
      notes: dup.notes ?? c.notes,
    };
    await upsertFlight(upgraded);
    if ((await getPrefs()).alerts) await scheduleReminders(upgraded).catch(() => {});
    return upgraded;
  }
  if (dup) return dup;
  const f: Flight = { ...c, id: newId(), addedAt: new Date().toISOString() };
  await upsertFlight(f);
  if ((await getPrefs()).alerts) await scheduleReminders(f).catch(() => {});
  return f;
}

export function flightWindow(f: Flight) {
  const dep = bestTime(f.departure);
  const arr = bestTime(f.arrival);
  return { dep: dep ? Date.parse(dep) : undefined, arr: arr ? Date.parse(arr) : undefined };
}

export function isPast(f: Flight, now = Date.now()) {
  if (f.status === 'Arrived' || f.status === 'Canceled' || f.status === 'Diverted') return true;
  const { arr, dep } = flightWindow(f);
  if (arr) return arr + 2 * 3600e3 < now;
  if (dep) return dep + 18 * 3600e3 < now;
  const [y, m, d] = f.dateLocal.split('-').map(Number);
  return new Date(y, m - 1, d + 1).getTime() < now;
}

export function isActive(f: Flight, now = Date.now()) {
  const { dep, arr } = flightWindow(f);
  if (!dep) return false;
  return now >= dep - 6 * 3600e3 && now <= (arr ?? dep + 18 * 3600e3) + 3600e3;
}

function describeChanges(prev: Flight, next: Flight): string[] {
  const out: string[] = [];
  const tz = next.departure.airport.timeZone;
  if (prev.status !== next.status && next.status !== 'Unknown') out.push(`Status: ${statusLabel(next.status)}`);
  if (next.departure.gate && prev.departure.gate !== next.departure.gate)
    out.push(prev.departure.gate ? `Gate changed ${prev.departure.gate} → ${next.departure.gate}` : `Departs from gate ${next.departure.gate}`);
  if (next.departure.terminal && prev.departure.terminal && prev.departure.terminal !== next.departure.terminal)
    out.push(`Terminal changed to ${next.departure.terminal}`);
  const pd = delayMinutes(prev.departure), nd = delayMinutes(next.departure);
  if (Math.abs(nd - pd) >= 10)
    out.push(nd > 0 ? `Delayed ${nd} min, now departs ${fmtTime(bestTime(next.departure), tz)}` : `Back on time, departs ${fmtTime(bestTime(next.departure), tz)}`);
  if (next.arrival.baggageBelt && prev.arrival.baggageBelt !== next.arrival.baggageBelt)
    out.push(`Bags at belt ${next.arrival.baggageBelt}`);
  if (next.arrival.gate && prev.arrival.gate !== next.arrival.gate) out.push(`Arrives at gate ${next.arrival.gate}`);
  return out;
}

function mergeAirport(prev: Airport, next: Airport): Airport {
  const same = (prev.iata && prev.iata === next.iata) || (prev.icao && prev.icao === next.icao);
  if (!same && (next.iata || next.icao)) return next;
  const defined = Object.fromEntries(Object.entries(next).filter(([, v]) => v != null && v !== ''));
  return { ...prev, ...defined } as Airport;
}

export async function refreshFlight(f: Flight, { notify = true } = {}): Promise<Flight> {
  if (!(await getApiKey())) return f;
  const results = await flightsByNumber(f.number, f.dateLocal);
  const sameRoute = (r: FlightCandidate) => r.departure.airport.iata === f.departure.airport.iata && r.arrival.airport.iata === f.arrival.airport.iata;
  const match =
    (f.departure.scheduledUtc && results.find((r) => sameRoute(r) && r.departure.scheduledUtc === f.departure.scheduledUtc)) ||
    results.find(sameRoute) ||
    results[0];
  if (!match || !getFlight(f.id)) return f;
  const next: Flight = withDistance({
    ...f,
    ...match,
    departure: { ...match.departure, airport: mergeAirport(f.departure.airport, match.departure.airport) },
    arrival: { ...match.arrival, airport: mergeAirport(f.arrival.airport, match.arrival.airport) },
    callSign: match.callSign ?? f.callSign,
    id: f.id,
    addedAt: f.addedAt,
    notes: f.notes,
  });
  const changes = describeChanges(f, next);
  await upsertFlight(next);
  if (notify && changes.length && (await getPrefs()).alerts) {
    await notifyNow(`${next.number} ${next.departure.airport.iata ?? ''} → ${next.arrival.airport.iata ?? ''}`, changes.join('\n'), next.id).catch(() => {});
  }
  if (bestTime(f.departure) !== bestTime(next.departure) && (await getPrefs()).alerts) await scheduleReminders(next).catch(() => {});
  return next;
}

export async function refreshActive() {
  const active = getFlights().filter((f) => !isPast(f));
  for (const f of active) await refreshFlight(f).catch(() => {});
}

function inLiveWindow(f: Flight, now = Date.now()) {
  if (flightWindow(f).dep) return isActive(f, now);
  const [y, m, d] = f.dateLocal.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  return now >= start - 12 * 3600e3 && now <= start + 36 * 3600e3;
}

export async function livePosition(f: Flight): Promise<LivePosition | null> {
  if (!inLiveWindow(f)) return null;
  if (f.callSign) {
    const byCs = await liveByCallsign(f.callSign);
    if (byCs) return byCs;
  }
  if (f.aircraft?.modeS) {
    const byHex = await liveByHex(f.aircraft.modeS);
    if (byHex) return byHex;
  }
  if (f.aircraft?.reg) return liveByReg(f.aircraft.reg);
  return null;
}

export async function inboundFlight(f: Flight): Promise<FlightCandidate | null> {
  const reg = f.aircraft?.reg;
  const dep = bestTime(f.departure);
  if (!reg || !dep || !(await getApiKey())) return null;
  const depMs = Date.parse(dep);
  const prevDay = new Date(depMs - 24 * 3600e3).toISOString().slice(0, 10);
  const legs = [...(await flightsByReg(reg, f.dateLocal)), ...(await flightsByReg(reg, prevDay).catch(() => []))];
  const candidates = legs
    .filter((l) => l.arrival.airport.iata === f.departure.airport.iata)
    .filter((l) => {
      const a = bestTime(l.arrival);
      return a && Date.parse(a) <= depMs;
    })
    .sort((a, b) => Date.parse(bestTime(b.arrival)!) - Date.parse(bestTime(a.arrival)!));
  return candidates[0] ?? null;
}

export function statusLabel(s: Flight['status']) {
  switch (s) {
    case 'EnRoute':
    case 'Departed':
      return 'In the air';
    case 'CheckIn':
      return 'Check-in open';
    case 'GateClosed':
      return 'Gate closed';
    case 'Approaching':
      return 'Landing soon';
    case 'Canceled':
    case 'CanceledUncertain':
      return 'Canceled';
    case 'Expected':
      return 'Scheduled';
    case 'Unknown':
      return 'Scheduled';
    default:
      return s;
  }
}

export function progress(f: Flight, now = Date.now()) {
  const dep = f.departure.runwayUtc ?? f.departure.revisedUtc ?? f.departure.scheduledUtc;
  const arr = bestTime(f.arrival);
  if (!dep || !arr) return f.status === 'Arrived' ? 1 : 0;
  const a = Date.parse(dep), b = Date.parse(arr);
  if (f.status === 'Arrived') return 1;
  if (now <= a) return 0;
  return Math.min(1, Math.max(0, (now - a) / (b - a)));
}
