import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FlightMap from '@/components/flight-map';
import { Button, Card, KV, T } from '@/components/ui';
import { routeByCallsign, type RouteInfo } from '@/lib/api/adsbdb';
import { liveNear } from '@/lib/api/live';
import { addFlight } from '@/lib/flights';
import { todayLocal } from '@/lib/format';
import { distanceKm } from '@/lib/geo';
import { C } from '@/lib/theme';
import type { LivePosition } from '@/lib/types';

const RADIUS_NM = 30;

export default function Overhead() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);
  const [planes, setPlanes] = useState<LivePosition[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Record<string, RouteInfo | null>>({});

  const locate = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    setErr(null);
    if (!perm.granted) return setErr('Location permission is needed to see planes near you.');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch
    locate().catch((e) => setErr(e?.message ?? 'Could not get location'));
  }, [locate]);

  useEffect(() => {
    if (!me) return;
    let stop = false;
    const tick = () =>
      liveNear(me.latitude, me.longitude, RADIUS_NM)
        .then((p) => !stop && setPlanes(p.filter((x) => !x.onGround)))
        .catch((e) => setErr(e?.message ?? 'Could not load nearby planes'));
    tick();
    const t = setInterval(tick, 10_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [me]);

  const sorted = useMemo(
    () =>
      (planes ?? [])
        .map((p) => ({ p, d: me ? distanceKm(me, { latitude: p.lat, longitude: p.lon }) : 0 }))
        .sort((a, b) => a.d - b.d),
    [planes, me]
  );
  const sel = sorted.find((x) => x.p.hex === selected)?.p;
  const route = sel ? (sel.callSign ? routes[sel.hex] : null) : undefined;

  useEffect(() => {
    if (!sel?.callSign || sel.hex in routes) return;
    const hex = sel.hex;
    routeByCallsign(sel.callSign).then((r) => setRoutes((m) => ({ ...m, [hex]: r })));
  }, [sel?.callSign, sel?.hex, routes]);

  const track = async () => {
    if (!route) return;
    await addFlight({
      number: route.callSignIata ?? route.callSignIcao,
      callSign: route.callSignIcao,
      dateLocal: todayLocal(),
      airline: route.airline,
      departure: { airport: route.origin },
      arrival: { airport: route.destination },
      status: 'EnRoute',
      source: 'route',
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: height * 0.45 }}>
        {me && (
          <FlightMap
            center={{ ...me, radiusDeg: 0.6 }}
            routes={
              sel && route
                ? [{ id: 'sel', from: { latitude: route.origin.lat!, longitude: route.origin.lon!, code: route.origin.iata }, to: { latitude: route.destination.lat!, longitude: route.destination.lon!, code: route.destination.iata } }]
                : []
            }
            planes={sorted.map(({ p }) => ({ id: p.hex, lat: p.lat, lon: p.lon, trackDeg: p.trackDeg }))}
            onPlanePress={setSelected}
          />
        )}
        <View style={[st.hud, { top: insets.top + 8 }]}>
          <T variant="h2">Overhead</T>
          <T variant="sub">{planes ? `${planes.length} planes within ${RADIUS_NM} nm` : 'Scanning…'}</T>
        </View>
      </View>
      <ScrollView contentContainerStyle={[st.wrap, { paddingBottom: insets.bottom + 100 }]}>
        {err && (
          <Card style={{ gap: 10 }}>
            <T style={{ color: C.amber }}>{err}</T>
            <Button title="Try again" kind="ghost" onPress={() => locate().catch(() => {})} />
          </Card>
        )}
        {sel && (
          <Card style={{ gap: 12, borderColor: C.accent }}>
            <View style={st.row}>
              <T variant="h2">{sel.callSign ?? sel.reg ?? sel.hex.toUpperCase()}</T>
              <T variant="sub">{sel.type ?? ''}</T>
            </View>
            {route === undefined ? (
              <ActivityIndicator color={C.accent} />
            ) : route ? (
              <T style={{ fontWeight: '700' }}>
                {route.airline?.name ? `${route.airline.name} · ` : ''}
                {route.origin.iata} {route.origin.city} → {route.destination.iata} {route.destination.city}
              </T>
            ) : (
              <T variant="sub">No route on file for this callsign.</T>
            )}
            <View style={st.row}>
              <KV k="Altitude" v={sel.altitudeFt != null ? `${sel.altitudeFt.toLocaleString()} ft` : null} />
              <KV k="Speed" v={sel.groundSpeedKt != null ? `${Math.round(sel.groundSpeedKt)} kt` : null} />
              <KV k="Tail" v={sel.reg} />
            </View>
            {route && <Button title="Track this flight" onPress={track} />}
          </Card>
        )}
        {!planes && !err && <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />}
        {sorted.map(({ p, d }) => (
          <Pressable key={p.hex} onPress={() => setSelected(p.hex)}>
            <View style={[st.item, selected === p.hex && { backgroundColor: C.cardHi }]}>
              <T style={{ color: C.accent, fontSize: 18, transform: [{ rotate: `${(p.trackDeg ?? 90) - 90}deg` }] }}>✈</T>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700' }}>{p.callSign ?? p.reg ?? p.hex.toUpperCase()}</T>
                <T variant="sub">
                  {p.type ?? 'Unknown type'} · {p.altitudeFt != null ? `${p.altitudeFt.toLocaleString()} ft` : '—'}
                </T>
              </View>
              <T variant="sub">{(d * 0.621371).toFixed(1)} mi</T>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 8 },
  hud: { position: 'absolute', left: 16, backgroundColor: C.bg + 'CC', padding: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: C.card },
});
