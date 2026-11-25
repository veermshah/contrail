import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { fmtDate, fmtTime } from '@/lib/format';
import { progress } from '@/lib/flights';
import { summarize } from '@/lib/summary';
import { C } from '@/lib/theme';
import type { Flight } from '@/lib/types';

import { Card, Pill, Progress, T } from './ui';

export function FlightCard({ flight: f, compact }: { flight: Flight; compact?: boolean }) {
  const sm = summarize(f);
  const p = progress(f);
  const depTz = f.departure.airport.timeZone, arrTz = f.arrival.airport.timeZone;
  return (
    <Link href={{ pathname: '/flight/[id]', params: { id: f.id } }} asChild>
      <Pressable style={({ pressed }) => pressed && { opacity: 0.8 }}>
        <Card style={{ gap: 10 }}>
          <View style={st.row}>
            <T variant="sub" style={{ fontWeight: '700', color: C.text }}>
              {f.number} <T variant="sub">· {f.airline?.name ?? ''}</T>
            </T>
            <T variant="sub">{sm.depTime ? fmtDate(sm.depTime, depTz) : f.dateLocal}</T>
          </View>
          <View style={st.row}>
            <View>
              <T variant="code">{f.departure.airport.iata ?? f.departure.airport.icao ?? '???'}</T>
              <T variant="sub">{f.departure.airport.city ?? f.departure.airport.name}</T>
            </View>
            <T style={{ color: C.dim, fontSize: 20 }}>✈</T>
            <View style={{ alignItems: 'flex-end' }}>
              <T variant="code">{f.arrival.airport.iata ?? f.arrival.airport.icao ?? '???'}</T>
              <T variant="sub">{f.arrival.airport.city ?? f.arrival.airport.name}</T>
            </View>
          </View>
          {!compact && (
            <>
              {p > 0 && p < 1 && <Progress value={p} />}
              <View style={st.row}>
                <T variant="big" style={{ fontSize: 17, color: sm.dDep >= 15 ? C.amber : C.text }}>
                  {fmtTime(sm.depTime, depTz)}
                </T>
                <T variant="big" style={{ fontSize: 17, color: sm.dArr >= 15 ? C.amber : C.text }}>
                  {fmtTime(sm.arrTime, arrTz)}
                </T>
              </View>
            </>
          )}
          <View style={st.row}>
            <T style={{ fontWeight: '600' }}>{sm.headline}</T>
            <Pill label={sm.tag} color={f.source === 'route' ? C.sub : sm.color} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const st = StyleSheet.create({ row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 } });
