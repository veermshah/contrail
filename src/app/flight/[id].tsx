import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';

import FlightMap from '@/components/flight-map';
import { Button, Card, KV, Pill, Progress, T } from '@/components/ui';
import { aircraftInfo, type AircraftInfo } from '@/lib/api/adsbdb';
import { MissingKeyError } from '@/lib/api/aerodatabox';
import { bestTime, delayMinutes, fmtDate, fmtDistance, fmtDuration, fmtTime } from '@/lib/format';
import { inboundFlight, isActive, livePosition, progress, refreshFlight, statusLabel, type FlightCandidate } from '@/lib/flights';
import { cancelReminders } from '@/lib/notifications';
import { getPrefs } from '@/lib/settings';
import { removeFlight, useFlight } from '@/lib/store';
import { summarize } from '@/lib/summary';
import { C } from '@/lib/theme';
import type { LivePosition, Movement } from '@/lib/types';

function MovementBlock({ m, label, align }: { m: Movement; label: string; align: 'left' | 'right' }) {
  const tz = m.airport.timeZone;
  const delay = delayMinutes(m);
  const best = bestTime(m);
  const changed = best && m.scheduledUtc && best !== m.scheduledUtc;
  const a = align === 'right' ? { alignItems: 'flex-end' as const } : null;
  return (
    <View style={[{ flex: 1, gap: 2 }, a]}>
      <T variant="label">{label}</T>
      <Link href={{ pathname: '/airport/[code]', params: { code: m.airport.iata ?? m.airport.icao ?? '' } }} asChild>
        <Pressable>
          <T variant="code">{m.airport.iata ?? m.airport.icao}</T>
        </Pressable>
      </Link>
      <T variant="sub" numberOfLines={1}>
        {m.airport.city ?? m.airport.name}
      </T>
      <T variant="big" style={{ marginTop: 6, color: delay >= 15 ? C.amber : delay <= -5 ? C.green : C.text }}>
        {fmtTime(best, tz)}
      </T>
      {changed ? <T variant="sub" style={{ textDecorationLine: 'line-through' }}>{fmtTime(m.scheduledUtc, tz)}</T> : null}
      <T variant="sub">
        {m.runwayUtc ? (label === 'Departs' ? 'Took off' : 'Landed') : m.revisedUtc ? 'Estimated' : 'Scheduled'}
        {delay >= 5 ? ` · +${fmtDuration(delay)}` : ''}
      </T>
    </View>
  );
}

export default function FlightDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useFlight(id);
  const { height } = useWindowDimensions();
  const [live, setLive] = useState<LivePosition | null>(null);
  const [inbound, setInbound] = useState<FlightCandidate | null | undefined>(undefined);
  const [inboundLive, setInboundLive] = useState<LivePosition | null>(null);
  const [plane, setPlane] = useState<AircraftInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [units, setUnits] = useState<'mi' | 'km'>('mi');

  useEffect(() => {
    getPrefs().then((p) => setUnits(p.units));
  }, []);

  const refresh = useCallback(
    async (manual = false) => {
      if (!f) return;
      if (manual) setRefreshing(true);
      try {
        const next = await refreshFlight(f, { notify: !manual });
        setErr(null);
        setLive(await livePosition(next));
      } catch (e: any) {
        if (!(e instanceof MissingKeyError)) setErr(e?.message ?? 'Refresh failed');
      } finally {
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f?.id]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch
    refresh();
    const active = f && isActive(f);
    const t = setInterval(() => refresh(), active ? 30_000 : 5 * 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!f) return;
    const key = f.aircraft?.modeS ?? f.aircraft?.reg ?? live?.hex;
    if (key) aircraftInfo(key).then(setPlane);
  }, [f?.aircraft?.modeS, f?.aircraft?.reg, live?.hex]);

  useEffect(() => {
    if (!f || !f.aircraft?.reg) return;
    inboundFlight(f)
      .then(async (inb) => {
        setInbound(inb);
        if (inb?.callSign && inb.status !== 'Arrived') {
          const { liveByCallsign } = await import('@/lib/api/live');
          setInboundLive(await liveByCallsign(inb.callSign));
        }
      })
      .catch(() => setInbound(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.aircraft?.reg, f?.id]);

  if (!f) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <T variant="sub">Flight not found.</T>
      </View>
    );
  }

  const sm = summarize(f);
  const p = progress(f);
  const dep = f.departure.airport, arr = f.arrival.airport;
  const hasCoords = dep.lat != null && dep.lon != null && arr.lat != null && arr.lon != null;
  const durMin = sm.depTime && sm.arrTime ? (Date.parse(sm.arrTime) - Date.parse(sm.depTime)) / 60000 : undefined;
  const airborne = live && !live.onGround && f.status !== 'Arrived';

  const share = () => {
    const msg = `${f.number} ${dep.iata} → ${arr.iata}\n${sm.headline}\nDeparts ${fmtTime(sm.depTime, dep.timeZone)} ${fmtDate(sm.depTime, dep.timeZone)}${f.departure.gate ? ` · Gate ${f.departure.gate}` : ''}\nArrives ${fmtTime(sm.arrTime, arr.timeZone)}${live ? `\nNow at ${Math.round(live.altitudeFt ?? 0).toLocaleString()} ft, ${Math.round(live.groundSpeedKt ?? 0)} kt` : ''}`;
    Share.share({ message: msg });
  };

  const del = () => {
    const go = async () => {
      await cancelReminders(f.id);
      await removeFlight(f.id);
      router.back();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Remove flight?', `${f.number} will be removed from your flights.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ height: height * 0.42 }}>
        {hasCoords && (
          <FlightMap
            routes={[{ id: f.id, from: { latitude: dep.lat!, longitude: dep.lon!, code: dep.iata }, to: { latitude: arr.lat!, longitude: arr.lon!, code: arr.iata } }]}
            planes={airborne ? [{ id: live.hex, lat: live.lat, lon: live.lon, trackDeg: live.trackDeg }] : []}
          />
        )}
      </View>
      <ScrollView contentContainerStyle={st.wrap}>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <T variant="sub" style={{ color: C.text, fontWeight: '700' }}>
              {f.number} · {f.airline?.name ?? ''}
            </T>
            <T variant="title" style={{ fontSize: 24 }}>{sm.headline}</T>
          </View>
          <Pill label={sm.tag} color={f.source === 'route' ? C.sub : sm.color} />
        </View>

        <Card style={{ gap: 14 }}>
          <View style={st.row}>
            <MovementBlock m={f.departure} label="Departs" align="left" />
            <MovementBlock m={f.arrival} label="Arrives" align="right" />
          </View>
          <Progress value={p} color={sm.color} />
          <View style={st.row}>
            <T variant="sub">{sm.depTime ? fmtDate(sm.depTime, dep.timeZone) : f.dateLocal}</T>
            <T variant="sub">
              {[durMin ? fmtDuration(durMin) : null, f.distanceKm ? fmtDistance(f.distanceKm, units) : null].filter(Boolean).join(' · ')}
            </T>
          </View>
        </Card>

        {f.source === 'aerodatabox' && (
          <Card style={{ gap: 14 }}>
            <T variant="label">Departure · {dep.iata}</T>
            <View style={st.row}>
              <KV k="Terminal" v={f.departure.terminal} />
              <KV k="Gate" v={f.departure.gate} color={C.accent} />
              <KV k="Check-in" v={f.departure.checkInDesk} />
            </View>
            <T variant="label">Arrival · {arr.iata}</T>
            <View style={st.row}>
              <KV k="Terminal" v={f.arrival.terminal} />
              <KV k="Gate" v={f.arrival.gate} color={C.accent} />
              <KV k="Bags" v={f.arrival.baggageBelt} />
            </View>
          </Card>
        )}

        {live && (
          <Card style={{ gap: 12 }}>
            <View style={st.row}>
              <T variant="label">{live.onGround ? 'On the ground' : 'Live'}</T>
              <T variant="sub">{live.seenSecondsAgo != null ? `${Math.round(live.seenSecondsAgo)}s ago` : ''}</T>
            </View>
            <View style={st.row}>
              <KV k="Altitude" v={live.onGround ? 'Ground' : `${Math.round(live.altitudeFt ?? 0).toLocaleString()} ft`} />
              <KV k="Speed" v={live.groundSpeedKt != null ? `${Math.round(units === 'mi' ? live.groundSpeedKt * 1.15078 : live.groundSpeedKt * 1.852)} ${units === 'mi' ? 'mph' : 'km/h'}` : null} />
              <KV k="Heading" v={live.trackDeg != null ? `${Math.round(live.trackDeg)}°` : null} />
            </View>
            {live.verticalRateFpm != null && Math.abs(live.verticalRateFpm) > 300 && !live.onGround && (
              <T variant="sub">
                {live.verticalRateFpm > 0 ? 'Climbing' : 'Descending'} at {Math.abs(Math.round(live.verticalRateFpm)).toLocaleString()} ft/min
              </T>
            )}
          </Card>
        )}

        {f.source === 'aerodatabox' && (
          <Card style={{ gap: 10 }}>
            <T variant="label">{"Where's my plane?"}</T>
            {inbound === undefined && f.aircraft?.reg ? (
              <ActivityIndicator color={C.accent} />
            ) : inbound ? (
              <>
                <T variant="h2">
                  {inbound.number} from {inbound.departure.airport.iata ?? inbound.departure.airport.name}
                </T>
                <T variant="sub">
                  {statusLabel(inbound.status)} · {inbound.arrival.runwayUtc ? 'landed' : 'lands'} {fmtTime(bestTime(inbound.arrival), dep.timeZone)}
                  {delayMinutes(inbound.arrival) >= 15 ? ` (${fmtDuration(delayMinutes(inbound.arrival))} late)` : ''}
                </T>
                {(() => {
                  const ia = bestTime(inbound.arrival), od = bestTime(f.departure);
                  if (!ia || !od) return null;
                  const turn = (Date.parse(od) - Date.parse(ia)) / 60000;
                  return (
                    <T style={{ color: turn < 35 ? C.amber : C.green, fontWeight: '700' }}>
                      {turn < 35 ? `Tight turnaround: ${fmtDuration(turn)} before your departure` : `${fmtDuration(turn)} turnaround before your departure`}
                    </T>
                  );
                })()}
                {inboundLive && !inboundLive.onGround && (
                  <T variant="sub">
                    In the air now at {Math.round(inboundLive.altitudeFt ?? 0).toLocaleString()} ft
                  </T>
                )}
              </>
            ) : (
              <T variant="sub">{f.aircraft?.reg ? 'No earlier leg found for this aircraft today.' : 'Aircraft not assigned yet. Check back closer to departure.'}</T>
            )}
          </Card>
        )}

        {(f.aircraft || plane) && (
          <Card style={{ gap: 12 }}>
            <T variant="label">Aircraft</T>
            {(plane?.photoUrl || f.aircraft?.imageUrl) && (
              <Image source={{ uri: f.aircraft?.imageUrl ?? plane?.photoUrl }} style={st.photo} resizeMode="cover" />
            )}
            <T variant="h2">{f.aircraft?.model ?? [plane?.manufacturer, plane?.type].filter(Boolean).join(' ')}</T>
            <View style={st.row}>
              <KV k="Tail" v={f.aircraft?.reg ?? plane?.reg} />
              <KV k="Mode-S" v={(f.aircraft?.modeS ?? plane?.modeS)?.toUpperCase()} />
              <KV k="Type" v={plane?.icaoType} />
            </View>
            {plane?.owner && <T variant="sub">Registered to {plane.owner}</T>}
            {f.aircraft?.imageAuthor && <T variant="sub">Photo: {f.aircraft.imageAuthor}</T>}
          </Card>
        )}

        {err && <T style={{ color: C.amber }}>{err}</T>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={refreshing ? 'Refreshing…' : 'Refresh'} kind="ghost" onPress={() => refresh(true)} style={{ flex: 1 }} />
          <Button title="Share" kind="ghost" onPress={share} style={{ flex: 1 }} />
        </View>
        <Button title="Remove flight" kind="danger" onPress={del} />
        <T variant="sub" style={{ textAlign: 'center' }}>
          {f.lastUpdatedUtc ? `Updated ${fmtTime(f.lastUpdatedUtc)} · ` : ''}
          {f.source === 'route' ? 'Route via adsbdb · ' : 'Schedule via AeroDataBox · '}Live via adsb.lol
        </T>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 60 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: C.cardHi },
});
