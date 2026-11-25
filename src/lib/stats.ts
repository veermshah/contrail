import { bestTime, delayMinutes } from './format';
import { isPast } from './flights';
import type { Flight } from './types';

export type Stats = {
  flights: number;
  distanceKm: number;
  minutes: number;
  airports: number;
  airlines: number;
  countries: number;
  aircraftTypes: number;
  longest?: Flight;
  topAirport?: { code: string; count: number };
  topAirline?: { name: string; count: number };
  topAircraft?: { name: string; count: number };
  avgDelayMin?: number;
  onTimePct?: number;
  byYear: { year: string; count: number }[];
};

const top = (m: Map<string, number>) => {
  let best: [string, number] | undefined;
  m.forEach((v, k) => {
    if (!best || v > best[1]) best = [k, v];
  });
  return best;
};

const bump = (m: Map<string, number>, k?: string) => k && m.set(k, (m.get(k) ?? 0) + 1);

export function computeStats(all: Flight[]): Stats {
  const flown = all.filter((f) => isPast(f) && f.status !== 'Canceled' && f.status !== 'CanceledUncertain');
  const airports = new Map<string, number>();
  const airlines = new Map<string, number>();
  const types = new Map<string, number>();
  const countries = new Set<string>();
  const years = new Map<string, number>();
  let distance = 0, minutes = 0, delaySum = 0, delayN = 0, onTime = 0;
  let longest: Flight | undefined;
  for (const f of flown) {
    distance += f.distanceKm ?? 0;
    const dep = bestTime(f.departure), arr = bestTime(f.arrival);
    if (dep && arr) minutes += (Date.parse(arr) - Date.parse(dep)) / 60000;
    else if (f.distanceKm) minutes += (f.distanceKm / 800) * 60 + 30;
    bump(airports, f.departure.airport.iata ?? f.departure.airport.icao);
    bump(airports, f.arrival.airport.iata ?? f.arrival.airport.icao);
    bump(airlines, f.airline?.name);
    bump(types, f.aircraft?.model);
    if (f.departure.airport.countryCode) countries.add(f.departure.airport.countryCode);
    if (f.arrival.airport.countryCode) countries.add(f.arrival.airport.countryCode);
    bump(years, f.dateLocal.slice(0, 4));
    if (!longest || (f.distanceKm ?? 0) > (longest.distanceKm ?? 0)) longest = f;
    if (f.departure.scheduledUtc && (f.departure.runwayUtc || f.departure.revisedUtc)) {
      const d = delayMinutes(f.arrival.scheduledUtc ? f.arrival : f.departure);
      delaySum += Math.max(0, d);
      delayN++;
      if (d <= 15) onTime++;
    }
  }
  const ta = top(airports), tl = top(airlines), tt = top(types);
  return {
    flights: flown.length,
    distanceKm: distance,
    minutes,
    airports: airports.size,
    airlines: airlines.size,
    countries: countries.size,
    aircraftTypes: types.size,
    longest,
    topAirport: ta && { code: ta[0], count: ta[1] },
    topAirline: tl && { name: tl[0], count: tl[1] },
    topAircraft: tt && { name: tt[0], count: tt[1] },
    avgDelayMin: delayN ? Math.round(delaySum / delayN) : undefined,
    onTimePct: delayN ? Math.round((onTime / delayN) * 100) : undefined,
    byYear: [...years.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, count]) => ({ year, count })),
  };
}
