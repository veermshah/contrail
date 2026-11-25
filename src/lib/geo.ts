const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export type LatLon = { latitude: number; longitude: number };

export function distanceKm(a: LatLon, b: LatLon) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a: LatLon, b: LatLon) {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function greatCircle(a: LatLon, b: LatLon, segments = 64): LatLon[] {
  const lat1 = toRad(a.latitude), lon1 = toRad(a.longitude);
  const lat2 = toRad(b.latitude), lon2 = toRad(b.longitude);
  const d = distanceKm(a, b) / R_KM;
  if (d === 0) return [a, b];
  const pts: LatLon[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push({ latitude: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), longitude: toDeg(Math.atan2(y, x)) });
  }
  return pts;
}

/** Shifts longitudes by ±360 so consecutive points never jump across the antimeridian. */
export function unwrapPath(pts: LatLon[]): LatLon[] {
  const out: LatLon[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    let lon = p.longitude;
    if (prev) while (lon - prev.longitude > 180) lon -= 360;
    if (prev) while (lon - prev.longitude < -180) lon += 360;
    out.push({ ...p, longitude: lon });
  }
  return out;
}

/** Splits a path into pieces that each stay within [-180, 180]. */
export function splitAntimeridian(pts: LatLon[]): LatLon[][] {
  const parts: LatLon[][] = [[]];
  pts.forEach((p, i) => {
    if (i && Math.abs(p.longitude - pts[i - 1].longitude) > 180) parts.push([]);
    parts[parts.length - 1].push(p);
  });
  return parts.filter((s) => s.length > 1);
}

export function regionFor(points: LatLon[], padding = 1.4) {
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * padding, 2),
    longitudeDelta: Math.max((maxLon - minLon) * padding, 2),
  };
}
