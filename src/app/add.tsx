import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Pill, T } from '@/components/ui';
import { fmtDateLocal, fmtTime, normalizeFlightNumber, todayLocal } from '@/lib/format';
import { addFlight, searchFlights, type FlightCandidate } from '@/lib/flights';
import { getApiKey } from '@/lib/settings';
import { C, R } from '@/lib/theme';

const DAYS = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const dayLabel = (o: number) => (o === 0 ? 'Today' : o === 1 ? 'Tomorrow' : o === -1 ? 'Yesterday' : fmtDateLocal(todayLocal(o)).split(',').slice(0, 2).join(','));

export default function AddFlight() {
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FlightCandidate[] | null>(null);
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    getApiKey().then((k) => setHasKey(!!k));
  }, []);

  const search = async () => {
    const n = normalizeFlightNumber(number);
    if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(n)) return setError('Enter a flight number like AA100 or UA 1.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Date must be YYYY-MM-DD.');
    setError(null);
    setLoading(true);
    try {
      const r = await searchFlights(n, date);
      setResults(r);
      if (!r.length) setError(`No flight ${n} found on ${fmtDateLocal(date)}.`);
    } catch (e: any) {
      setError(e?.message ?? 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const add = async (c: FlightCandidate) => {
    const f = await addFlight(c);
    router.dismiss();
    router.push({ pathname: '/flight/[id]', params: { id: f.id } });
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
      <T variant="label">Flight number</T>
      <TextInput
        value={number}
        onChangeText={setNumber}
        placeholder="AA 100"
        placeholderTextColor={C.dim}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
        onSubmitEditing={search}
        style={st.input}
      />
      <T variant="label">Date</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {DAYS.map((o) => {
          const d = todayLocal(o);
          const on = d === date;
          return (
            <Pressable key={o} onPress={() => setDate(d)} style={[st.chip, on && { backgroundColor: C.accent, borderColor: C.accent }]}>
              <T style={{ color: on ? C.bg : C.text, fontWeight: '700', fontSize: 13 }}>{dayLabel(o)}</T>
            </Pressable>
          );
        })}
      </ScrollView>
      <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.dim} style={[st.input, { fontSize: 16 }]} />
      <Button title={loading ? 'Searching…' : 'Find flight'} onPress={search} disabled={loading} />
      {!hasKey && (
        <T variant="sub">
          No AeroDataBox key yet, so only the route and live position will load. Add a key in Settings for times, gates and delays.
        </T>
      )}
      {loading && <ActivityIndicator color={C.accent} />}
      {error && <T style={{ color: C.amber }}>{error}</T>}
      {results?.map((r, i) => (
        <Card key={i} style={{ gap: 8 }}>
          <View style={st.row}>
            <T variant="h2">
              {r.number} · {r.airline?.name ?? ''}
            </T>
            <Pill label={r.source === 'route' ? 'Route only' : r.status} color={C.accent} />
          </View>
          <View style={st.row}>
            <View>
              <T variant="code">{r.departure.airport.iata ?? r.departure.airport.icao}</T>
              <T variant="sub">{fmtTime(r.departure.scheduledUtc, r.departure.airport.timeZone)}</T>
            </View>
            <T style={{ color: C.dim, fontSize: 20 }}>✈</T>
            <View style={{ alignItems: 'flex-end' }}>
              <T variant="code">{r.arrival.airport.iata ?? r.arrival.airport.icao}</T>
              <T variant="sub">{fmtTime(r.arrival.scheduledUtc, r.arrival.airport.timeZone)}</T>
            </View>
          </View>
          <T variant="sub">
            {r.departure.airport.name} → {r.arrival.airport.name}
          </T>
          <Button title="Add to my flights" onPress={() => add(r)} />
        </Card>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 60 },
  input: { backgroundColor: C.card, color: C.text, fontSize: 24, fontWeight: '700', borderRadius: R.md, padding: 14, borderWidth: 1, borderColor: C.line },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
