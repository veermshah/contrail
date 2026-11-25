import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Pill, T } from '@/components/ui';
import { airportBoard, type BoardRow } from '@/lib/api/aerodatabox';
import { fmtTime } from '@/lib/format';
import { statusLabel } from '@/lib/flights';
import { getFlights } from '@/lib/store';
import { C } from '@/lib/theme';

export default function AirportBoard() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [dir, setDir] = useState<'Departure' | 'Arrival'>('Departure');
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const known = getFlights().flatMap((f) => [f.departure.airport, f.arrival.airport]).find((a) => a.iata === code);
  const tz = known?.timeZone;

  const fetchBoard = useCallback(
    () =>
      airportBoard(code, dir)
        .then((r) => {
          setErr(null);
          setRows(r);
        })
        .catch((e) => {
          setErr(e?.message ?? 'Could not load board');
          setRows([]);
        }),
    [code, dir]
  );

  const load = async () => {
    setLoading(true);
    await fetchBoard();
    setLoading(false);
  };

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: known ? `${code} · ${known.city ?? known.name}` : code }} />
      <View style={st.seg}>
        {(['Departure', 'Arrival'] as const).map((d) => (
          <Pressable key={d} onPress={() => { if (d !== dir) { setRows(null); setDir(d); } }} style={[st.segBtn, dir === d && { backgroundColor: C.cardHi }]}>
            <T style={{ fontWeight: '700', color: dir === d ? C.text : C.sub }}>{d === 'Departure' ? 'Departures' : 'Arrivals'}</T>
          </Pressable>
        ))}
      </View>
      {err && <T style={{ color: C.amber, padding: 16 }}>{err}</T>}
      {rows === null ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => `${r.number}-${i}`}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item: r }) => {
            const late = r.revisedUtc && r.scheduledUtc && Date.parse(r.revisedUtc) - Date.parse(r.scheduledUtc) >= 15 * 60e3;
            const canceled = r.status === 'Canceled' || r.status === 'CanceledUncertain';
            return (
              <View style={st.row}>
                <View style={{ width: 72 }}>
                  <T style={{ fontWeight: '800', fontVariant: ['tabular-nums'], color: late ? C.amber : C.text }}>{fmtTime(r.revisedUtc ?? r.scheduledUtc, tz)}</T>
                  {late ? <T variant="sub" style={{ textDecorationLine: 'line-through' }}>{fmtTime(r.scheduledUtc, tz)}</T> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700' }} numberOfLines={1}>
                    {r.other.iata ?? ''} {r.other.city ?? r.other.name}
                  </T>
                  <T variant="sub" numberOfLines={1}>
                    {r.number} · {r.airline ?? ''}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <T style={{ fontWeight: '800', color: C.accent }}>{r.gate ? `Gate ${r.gate}` : r.terminal ? `T${r.terminal}` : ''}</T>
                  <Pill label={statusLabel(r.status)} color={canceled ? C.red : late ? C.amber : C.sub} />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={!err ? <T variant="sub" style={{ padding: 16 }}>No flights in the next 6 hours.</T> : undefined}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  seg: { flexDirection: 'row', margin: 16, backgroundColor: C.card, borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
});
