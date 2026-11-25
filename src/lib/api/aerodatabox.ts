import { getApiKey } from '../settings';
import type { Airport, Flight, FlightStatus, Movement } from '../types';
import { getJson, HttpError } from './http';

const HOST = 'aerodatabox.p.rapidapi.com';

export class MissingKeyError extends Error {
  constructor() {
    super('Add an AeroDataBox key in Settings to load schedules, delays and gates.');
  }
}

async function adb<T>(path: string, key?: string): Promise<T> {
  const k = key ?? (await getApiKey());
  if (!k) throw new MissingKeyError();
  return getJson<T>(`https://${HOST}${path}`, {
    headers: { 'X-RapidAPI-Key': k, 'X-RapidAPI-Host': HOST },
  });
}

export const utcToIso = (s?: string) => (s ? s.replace(' ', 'T') : undefined);

const toAirport = (a: any): Airport => ({
  iata: a?.iata,
  icao: a?.icao,
  name: a?.shortName || a?.name || a?.iata || a?.icao || 'Unknown',
  city: a?.municipalityName,
  countryCode: a?.countryCode,
  lat: a?.location?.lat,
  lon: a?.location?.lon,
  timeZone: a?.timeZone,
});

const toMovement = (m: any): Movement => ({
  airport: toAirport(m?.airport),
  scheduledUtc: utcToIso(m?.scheduledTime?.utc),
  revisedUtc: utcToIso(m?.revisedTime?.utc),
  predictedUtc: utcToIso(m?.predictedTime?.utc),
  runwayUtc: utcToIso(m?.runwayTime?.utc),
  terminal: m?.terminal,
  gate: m?.gate,
  checkInDesk: m?.checkInDesk,
  baggageBelt: m?.baggageBelt,
});

export function mapFlight(f: any, dateLocal: string): Omit<Flight, 'id' | 'addedAt'> {
  return {
    number: (f.number ?? '').replace(/\s+/g, ''),
    callSign: f.callSign,
    dateLocal,
    airline: f.airline ? { name: f.airline.name, iata: f.airline.iata, icao: f.airline.icao } : undefined,
    departure: toMovement(f.departure),
    arrival: toMovement(f.arrival),
    status: (f.status ?? 'Unknown') as FlightStatus,
    aircraft: f.aircraft
      ? {
          reg: f.aircraft.reg,
          modeS: f.aircraft.modeS,
          model: f.aircraft.model,
          imageUrl: f.aircraft.image?.url,
          imageAuthor: f.aircraft.image?.author,
        }
      : undefined,
    distanceKm: f.greatCircleDistance?.km,
    source: 'aerodatabox',
    lastUpdatedUtc: utcToIso(f.lastUpdatedUtc),
  };
}

export async function flightsByNumber(number: string, dateLocal: string) {
  const data = await adb<any[] | undefined>(
    `/flights/number/${encodeURIComponent(number)}/${dateLocal}?withAircraftImage=true&withLocation=false`
  ).catch((e) => {
    if (e instanceof HttpError && e.status === 404) return [];
    throw e;
  });
  return (data ?? []).map((f) => mapFlight(f, dateLocal));
}

export async function flightsByReg(reg: string, dateLocal: string) {
  const data = await adb<any[] | undefined>(`/flights/reg/${encodeURIComponent(reg)}/${dateLocal}`).catch(
    (e) => {
      if (e instanceof HttpError && e.status === 404) return [];
      throw e;
    }
  );
  return (data ?? []).map((f) => mapFlight(f, dateLocal));
}

export type BoardRow = {
  number: string;
  airline?: string;
  other: Airport;
  scheduledUtc?: string;
  revisedUtc?: string;
  terminal?: string;
  gate?: string;
  status: FlightStatus;
  aircraftModel?: string;
};

export async function airportBoard(code: string, direction: 'Departure' | 'Arrival') {
  const data = await adb<{ departures?: any[]; arrivals?: any[] }>(
    `/flights/airports/iata/${encodeURIComponent(code)}?offsetMinutes=-30&durationMinutes=360&direction=${direction}&withLeg=true&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false`
  );
  const rows = (direction === 'Departure' ? data?.departures : data?.arrivals) ?? [];
  return rows.map((r): BoardRow => {
    const here = direction === 'Departure' ? r.departure : r.arrival;
    const other = direction === 'Departure' ? r.arrival : r.departure;
    return {
      number: (r.number ?? '').replace(/\s+/g, ''),
      airline: r.airline?.name,
      other: toAirport(other?.airport),
      scheduledUtc: utcToIso(here?.scheduledTime?.utc),
      revisedUtc: utcToIso(here?.revisedTime?.utc),
      terminal: here?.terminal,
      gate: here?.gate,
      status: r.status ?? 'Unknown',
      aircraftModel: r.aircraft?.model,
    };
  });
}

export async function testKey(key: string) {
  await adb(`/airports/iata/DFW`, key);
}
