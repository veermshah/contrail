import type { LivePosition } from '../types';
import { getJson } from './http';

const BASE = 'https://api.adsb.lol/v2';

type Ac = {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  lat?: number;
  lon?: number;
  seen_pos?: number;
  dst?: number;
};

const toLive = (a: Ac): LivePosition | null =>
  a.lat == null || a.lon == null
    ? null
    : {
        hex: a.hex,
        callSign: a.flight?.trim() || undefined,
        reg: a.r,
        type: a.t,
        lat: a.lat,
        lon: a.lon,
        altitudeFt: typeof a.alt_baro === 'number' ? a.alt_baro : undefined,
        onGround: a.alt_baro === 'ground',
        groundSpeedKt: a.gs,
        trackDeg: a.track ?? a.true_heading,
        verticalRateFpm: a.baro_rate ?? a.geom_rate,
        squawk: a.squawk,
        seenSecondsAgo: a.seen_pos,
      };

async function list(path: string) {
  const data = await getJson<{ ac?: Ac[] }>(`${BASE}${path}`);
  return (data?.ac ?? []).map(toLive).filter((x): x is LivePosition => !!x);
}

export async function liveByCallsign(callsign: string) {
  const [first] = await list(`/callsign/${encodeURIComponent(callsign.trim().toUpperCase())}`).catch(() => []);
  return first ?? null;
}

export async function liveByHex(hex: string) {
  const [first] = await list(`/hex/${encodeURIComponent(hex.toLowerCase())}`).catch(() => []);
  return first ?? null;
}

export async function liveByReg(reg: string) {
  const [first] = await list(`/reg/${encodeURIComponent(reg.toUpperCase())}`).catch(() => []);
  return first ?? null;
}

export async function liveNear(lat: number, lon: number, radiusNm = 25) {
  const r = Math.min(Math.max(Math.round(radiusNm), 1), 250);
  return list(`/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${r}`);
}
