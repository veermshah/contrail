import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlightCard } from '@/components/flight-card';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, Card, T } from '@/components/ui';
import { bestTime, fmtDuration } from '@/lib/format';
import { isPast, refreshActive } from '@/lib/flights';
import { useFlights } from '@/lib/store';
import { C } from '@/lib/theme';
import type { Flight } from '@/lib/types';

const when = (f: Flight) => Date.parse(bestTime(f.departure) ?? `${f.dateLocal}T12:00:00`);

export default function FlightsScreen() {
  const insets = useSafeAreaInsets();
  const flights = useFlights();
  const [refreshing, setRefreshing] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const up = flights.filter((f) => !isPast(f)).sort((a, b) => when(a) - when(b));
    const pa = flights.filter((f) => isPast(f)).sort((a, b) => when(b) - when(a));
    return { upcoming: up, past: pa };
  }, [flights]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshActive().catch(() => {});
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={[st.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}>
      <View style={st.header}>
        <View>
          <T variant="label">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
          <T variant="title" style={{ fontSize: 34 }}>My Flights</T>
        </View>
        <Link href="/add" asChild>
          <Pressable style={st.add} hitSlop={10} accessibilityLabel="Add flight">
            <T style={{ color: C.bg, fontSize: 24, fontWeight: '800', lineHeight: 26 }}>+</T>
          </Pressable>
        </Link>
      </View>

      {upcoming.length === 0 && (
        <Card style={{ gap: 12, alignItems: 'center', paddingVertical: 32 }}>
          <T style={{ fontSize: 40 }}>✈</T>
          <T variant="h2">No upcoming flights</T>
          <T variant="sub" style={{ textAlign: 'center' }}>Add a flight number to track gates, delays and the plane itself.</T>
          <Link href="/add" asChild>
            <Button title="Add a flight" style={{ alignSelf: 'stretch' }} />
          </Link>
        </Card>
      )}
      {upcoming[0] && <NextUp f={upcoming[0]} />}
      {upcoming.map((f) => (
        <FlightCard key={f.id} flight={f} />
      ))}

      {past.length > 0 && (
        <Pressable onPress={() => setShowPast((v) => !v)} style={st.pastToggle}>
          <T variant="label">Past flights · {past.length}</T>
          <T variant="label">{showPast ? 'Hide' : 'Show'}</T>
        </Pressable>
      )}
      {showPast && past.map((f) => <FlightCard key={f.id} flight={f} compact />)}
    </ScrollView>
  );
}

function NextUp({ f }: { f: Flight }) {
  const [now] = useState(() => Date.now());
  const mins = (when(f) - now) / 60000;
  if (!Number.isFinite(mins) || mins < 0 || mins > 14 * 24 * 60) return null;
  return (
    <View style={st.hero}>
      <LinearGradient colors={[C.accent + '40', C.purple + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <T variant="label" style={{ color: C.accent }}>Next departure</T>
      <T style={st.heroBig}>{fmtDuration(mins)}</T>
      <T variant="sub">
        until {f.number} to {f.arrival.airport.city ?? f.arrival.airport.iata}
        {f.departure.gate ? ` · Gate ${f.departure.gate}` : ''}
      </T>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: 28, padding: 22, gap: 4, overflow: 'hidden', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.accent + '55' },
  heroBig: { color: C.text, fontSize: 48, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  wrap: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  pastToggle: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 8 },
});
