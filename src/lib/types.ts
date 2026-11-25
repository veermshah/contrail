export type Airport = {
  iata?: string;
  icao?: string;
  name: string;
  city?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  timeZone?: string;
};

export type Movement = {
  airport: Airport;
  scheduledUtc?: string;
  revisedUtc?: string;
  predictedUtc?: string;
  runwayUtc?: string;
  terminal?: string;
  gate?: string;
  checkInDesk?: string;
  baggageBelt?: string;
};

export type FlightStatus =
  | 'Unknown'
  | 'Expected'
  | 'EnRoute'
  | 'CheckIn'
  | 'Boarding'
  | 'GateClosed'
  | 'Departed'
  | 'Delayed'
  | 'Approaching'
  | 'Arrived'
  | 'Canceled'
  | 'Diverted'
  | 'CanceledUncertain';

export type Aircraft = {
  reg?: string;
  modeS?: string;
  model?: string;
  imageUrl?: string;
  imageAuthor?: string;
};

export type Flight = {
  id: string;
  number: string;
  callSign?: string;
  dateLocal: string;
  airline?: { name?: string; iata?: string; icao?: string };
  departure: Movement;
  arrival: Movement;
  status: FlightStatus;
  aircraft?: Aircraft;
  distanceKm?: number;
  source: 'aerodatabox' | 'route' | 'manual';
  lastUpdatedUtc?: string;
  addedAt: string;
  notes?: string;
};

export type LivePosition = {
  hex: string;
  callSign?: string;
  reg?: string;
  type?: string;
  lat: number;
  lon: number;
  altitudeFt?: number;
  onGround: boolean;
  groundSpeedKt?: number;
  trackDeg?: number;
  verticalRateFpm?: number;
  squawk?: string;
  seenSecondsAgo?: number;
};
