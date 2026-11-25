import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlightCard } from '@/components/flight-card';
import { Button, Card, T } from '@/components/ui';
import { bestTime } from '@/lib/format';
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
        <T variant="title">Flights</T>
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

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  add: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  pastToggle: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 8 },
});
