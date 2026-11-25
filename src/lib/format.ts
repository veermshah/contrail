import type { Movement } from './types';

export const bestTime = (m: Movement) => m.runwayUtc ?? m.revisedUtc ?? m.predictedUtc ?? m.scheduledUtc;

export function delayMinutes(m: Movement) {
  const best = bestTime(m);
  if (!best || !m.scheduledUtc) return 0;
  return Math.round((Date.parse(best) - Date.parse(m.scheduledUtc)) / 60000);
}

export function fmtTime(iso?: string, timeZone?: string) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  try {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
  } catch {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

export function fmtDate(iso?: string, timeZone?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone });
  } catch {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

export function fmtDateLocal(dateLocal: string) {
  const [y, m, d] = dateLocal.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDuration(min: number) {
  const m = Math.max(0, Math.round(Math.abs(min)));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h >= 48) return `${Math.round(h / 24)}d`;
  if (h === 0) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function fmtDistance(km: number, units: 'mi' | 'km') {
  const v = units === 'mi' ? km * 0.621371 : km;
  return `${Math.round(v).toLocaleString('en-US')} ${units}`;
}

export function todayLocal(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const normalizeFlightNumber = (s: string) => s.replace(/\s+/g, '').toUpperCase();
