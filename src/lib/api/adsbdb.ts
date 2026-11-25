import type { Airport } from '../types';
import { getJson } from './http';

const BASE = 'https://api.adsbdb.com/v0';

type AdsbdbAirport = {
  iata_code: string;
  icao_code: string;
  name: string;
  municipality: string;
  country_iso_name: string;
  latitude: number;
  longitude: number;
};

export type RouteInfo = {
  callSignIcao: string;
  callSignIata?: string;
  airline?: { name: string; iata?: string; icao?: string };
  origin: Airport;
  destination: Airport;
};

const toAirport = (a: AdsbdbAirport): Airport => ({
  iata: a.iata_code,
  icao: a.icao_code,
  name: a.name,
  city: a.municipality,
  countryCode: a.country_iso_name,
  lat: a.latitude,
  lon: a.longitude,
});

async function iataToIcaoCallsign(cs: string): Promise<string | null> {
  const m = cs.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  if (!m) return null;
  try {
    const data = await getJson<{ response: { icao?: string }[] }>(`${BASE}/airline/${m[1]}`);
    const icao = Array.isArray(data?.response) ? data.response.find((a) => a.icao)?.icao : undefined;
    return icao ? `${icao}${m[2]}` : null;
  } catch {
    return null;
  }
}

export async function routeByCallsign(callsign: string): Promise<RouteInfo | null> {
  const cs = callsign.replace(/\s+/g, '').toUpperCase();
  const route = await routeByExactCallsign(cs);
  if (route) return route;
  const icao = await iataToIcaoCallsign(cs);
  return icao ? routeByExactCallsign(icao) : null;
}

async function routeByExactCallsign(cs: string): Promise<RouteInfo | null> {
  try {
    const data = await getJson<{ response: any }>(`${BASE}/callsign/${encodeURIComponent(cs)}`);
    const r = data?.response?.flightroute;
    if (!r) return null;
    return {
      callSignIcao: r.callsign_icao ?? r.callsign,
      callSignIata: r.callsign_iata ?? undefined,
      airline: r.airline ? { name: r.airline.name, iata: r.airline.iata, icao: r.airline.icao } : undefined,
      origin: toAirport(r.origin),
      destination: toAirport(r.destination),
    };
  } catch {
    return null;
  }
}

export type AircraftInfo = {
  type?: string;
  icaoType?: string;
  manufacturer?: string;
  reg?: string;
  modeS?: string;
  owner?: string;
  photoUrl?: string;
};

export async function aircraftInfo(hexOrReg: string): Promise<AircraftInfo | null> {
  try {
    const data = await getJson<{ response: any }>(`${BASE}/aircraft/${encodeURIComponent(hexOrReg)}`);
    const a = data?.response?.aircraft;
    if (!a) return null;
    return {
      type: a.type,
      icaoType: a.icao_type,
      manufacturer: a.manufacturer,
      reg: a.registration,
      modeS: a.mode_s,
      owner: a.registered_owner,
      photoUrl: a.url_photo ?? undefined,
    };
  } catch {
    return null;
  }
}
