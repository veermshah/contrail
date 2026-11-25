import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlightCard } from '@/components/flight-card';
import FlightMap from '@/components/flight-map';
import { Card, T } from '@/components/ui';
import { bestTime, fmtDistance, fmtDuration } from '@/lib/format';
import { isPast } from '@/lib/flights';
import { getPrefs } from '@/lib/settings';
import { computeStats } from '@/lib/stats';
import { useFlights } from '@/lib/store';
import { C } from '@/lib/theme';

const EARTH_KM = 40075;
const MOON_KM = 384400;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={st.stat}>
      <T variant="big">{value}</T>
      <T variant="label">{label}</T>
    </Card>
  );
}

export default function Passport() {
  const insets = useSafeAreaInsets();
  const flights = useFlights();
  const [units, setUnits] = useState<'mi' | 'km'>('mi');
  useEffect(() => {
    getPrefs().then((p) => setUnits(p.units));
  }, []);
  const s = useMemo(() => computeStats(flights), [flights]);
  const past = useMemo(
    () =>
      flights
        .filter((f) => isPast(f))
        .sort((a, b) => Date.parse(bestTime(b.departure) ?? b.dateLocal) - Date.parse(bestTime(a.departure) ?? a.dateLocal)),
    [flights]
  );
  const routes = past
    .filter((f) => f.departure.airport.lat != null && f.arrival.airport.lat != null)
    .map((f) => ({
      id: f.id,
      from: { latitude: f.departure.airport.lat!, longitude: f.departure.airport.lon!, code: f.departure.airport.iata },
      to: { latitude: f.arrival.airport.lat!, longitude: f.arrival.airport.lon!, code: f.arrival.airport.iata },
    }));

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={[st.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]}>
      <T variant="title">Passport</T>
      <View style={st.map}>
        <FlightMap routes={routes} />
        {routes.length === 0 && (
          <View style={st.empty}>
            <T variant="sub">Your flown routes will appear here.</T>
          </View>
        )}
      </View>
      <View style={st.grid}>
        <Stat label="Flights" value={s.flights} />
        <Stat label="Distance" value={fmtDistance(s.distanceKm, units)} />
        <Stat label="Time aloft" value={fmtDuration(s.minutes)} />
        <Stat label="Airports" value={s.airports} />
        <Stat label="Airlines" value={s.airlines} />
        <Stat label="Countries" value={s.countries} />
        <Stat label="Aircraft types" value={s.aircraftTypes} />
        <Stat label="Around Earth" value={`${(s.distanceKm / EARTH_KM).toFixed(2)}×`} />
        <Stat label="To the Moon" value={`${((s.distanceKm / MOON_KM) * 100).toFixed(1)}%`} />
      </View>
      {(s.topAirport || s.topAirline || s.longest || s.onTimePct != null) && (
        <Card style={{ gap: 10 }}>
          {s.topAirport && <T>Top airport: <T style={{ fontWeight: '800' }}>{s.topAirport.code}</T> ({s.topAirport.count} visits)</T>}
          {s.topAirline && <T>Top airline: <T style={{ fontWeight: '800' }}>{s.topAirline.name}</T> ({s.topAirline.count})</T>}
          {s.topAircraft && <T>Most flown aircraft: <T style={{ fontWeight: '800' }}>{s.topAircraft.name}</T></T>}
          {s.longest && (
            <T>
              Longest: <T style={{ fontWeight: '800' }}>{s.longest.number} {s.longest.departure.airport.iata}–{s.longest.arrival.airport.iata}</T>
              {s.longest.distanceKm ? ` (${fmtDistance(s.longest.distanceKm, units)})` : ''}
            </T>
          )}
          {s.onTimePct != null && <T>On time: <T style={{ fontWeight: '800' }}>{s.onTimePct}%</T> · avg delay {s.avgDelayMin} min</T>}
          {s.byYear.length > 1 && <T variant="sub">{s.byYear.map((y) => `${y.year}: ${y.count}`).join('  ·  ')}</T>}
        </Card>
      )}
      {past.length > 0 && <T variant="label" style={{ marginTop: 8 }}>Flight log</T>}
      {past.map((f) => (
        <FlightCard key={f.id} flight={f} compact />
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  map: { height: 220, borderRadius: 22, overflow: 'hidden', backgroundColor: C.card },
  empty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '30%', gap: 4, padding: 14 },
});
