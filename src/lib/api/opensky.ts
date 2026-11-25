import type { Airport } from '../types';
import AIRPORTS from '../airports.json';
import { routeByCallsign } from './adsbdb';
import type { BoardRow } from './aerodatabox';
import { getJson, HttpError } from './http';

type Row = [icao: string, name: string, city: string, lat: number, lon: number, country: string];
const BY_IATA = AIRPORTS as unknown as Record<string, Row>;
const BY_ICAO: Record<string, string> = Object.fromEntries(Object.entries(BY_IATA).map(([iata, r]) => [r[0], iata]));

export function airportByCode(code: string): Airport | undefined {
  const c = code.toUpperCase();
  const iata = BY_IATA[c] ? c : BY_ICAO[c];
  const r = iata ? BY_IATA[iata] : undefined;
  return r && { iata, icao: r[0], name: r[1], city: r[2] || undefined, lat: r[3], lon: r[4], countryCode: r[5] };
}

type OsFlight = { callsign?: string; firstSeen: number; lastSeen: number; estDepartureAirport?: string; estArrivalAirport?: string };

/** Keyless board from OpenSky ADS-B: actual takeoffs/landings in the last 2 hours. */
export async function recentBoard(code: string, direction: 'Departure' | 'Arrival', icaoHint?: string): Promise<BoardRow[]> {
  const icao = airportByCode(code)?.icao ?? icaoHint ?? (/^[A-Z]{4}$/i.test(code) ? code.toUpperCase() : undefined);
  if (!icao) throw new Error(`Unknown airport ${code}`);
  const ap = { icao };
  const end = Math.floor(Date.now() / 1000);
  const kind = direction === 'Departure' ? 'departure' : 'arrival';
  const data = await getJson<OsFlight[]>(
    `https://opensky-network.org/api/flights/${kind}?airport=${ap.icao}&begin=${end - 7200}&end=${end}`
  ).catch((e) => {
    if (e instanceof HttpError && e.status === 404) return [] as OsFlight[];
    throw e;
  });
  const flights = (Array.isArray(data) ? data : [])
    .filter((f) => f.callsign?.trim())
    .sort((a, b) => (direction === 'Departure' ? b.firstSeen - a.firstSeen : b.lastSeen - a.lastSeen))
    .slice(0, 30);
  return Promise.all(
    flights.map(async (f): Promise<BoardRow> => {
      const cs = f.callsign!.trim();
      const route = await routeByCallsign(cs).catch(() => null);
      const otherIcao = direction === 'Departure' ? f.estArrivalAirport : f.estDepartureAirport;
      const here = direction === 'Departure' ? route?.origin : route?.destination;
      const other =
        (here?.icao === ap.icao ? (direction === 'Departure' ? route?.destination : route?.origin) : undefined) ??
        (otherIcao ? airportByCode(otherIcao) : undefined) ?? { name: '' };
      return {
        number: route?.callSignIata ?? cs,
        airline: route?.airline?.name,
        other,
        revisedUtc: new Date((direction === 'Departure' ? f.firstSeen : f.lastSeen) * 1000).toISOString(),
        status: direction === 'Departure' ? 'Departed' : 'Arrived',
      };
    })
  );
}
