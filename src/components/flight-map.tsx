import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { greatCircle, regionFor, splitAntimeridian, unwrapPath, type LatLon } from '@/lib/geo';
import { C } from '@/lib/theme';

import type { FlightMapProps } from './map-types';

function splitAtPlane(path: LatLon[], plane?: LatLon) {
  if (!plane) return { flown: [] as LatLon[], rest: path };
  let best = 0, bestD = Infinity;
  path.forEach((p, i) => {
    const d = (p.latitude - plane.latitude) ** 2 + (p.longitude - plane.longitude) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return { flown: [...path.slice(0, best + 1), plane], rest: [plane, ...path.slice(best + 1)] };
}

export default function FlightMap({ routes, planes = [], center, style, onPlanePress }: FlightMapProps) {
  const paths = useMemo(() => routes.map((r) => ({ r, path: greatCircle(r.from, r.to) })), [routes]);
  const region = useMemo(() => {
    if (center)
      return { latitude: center.latitude, longitude: center.longitude, latitudeDelta: center.radiusDeg * 2, longitudeDelta: center.radiusDeg * 2 };
    const pts = paths.flatMap((p) => unwrapPath(p.path));
    planes.forEach((p) => pts.push({ latitude: p.lat, longitude: p.lon }));
    if (!pts.length) return { latitude: 30, longitude: -40, latitudeDelta: 100, longitudeDelta: 160 };
    const reg = regionFor(pts);
    return { ...reg, longitude: ((reg.longitude + 540) % 360) - 180 };
  }, [paths, planes, center]);

  const single = routes.length === 1 ? planes[0] : undefined;
  const airports = new Map<string, LatLon & { code?: string }>();
  routes.forEach((r) => {
    airports.set(`${r.from.latitude},${r.from.longitude}`, r.from);
    airports.set(`${r.to.latitude},${r.to.longitude}`, r.to);
  });

  return (
    <MapView
      style={[StyleSheet.absoluteFill, style]}
      initialRegion={region}
      userInterfaceStyle="dark"
      mapType="mutedStandard"
      showsPointsOfInterests={false}
      showsCompass={false}
      showsUserLocation={!!center}
      rotateEnabled={false}
      pitchEnabled={false}>
      {paths.map(({ r, path }) => {
        const { flown, rest } = splitAtPlane(path, single ? { latitude: single.lat, longitude: single.lon } : undefined);
        return (
          <View key={r.id}>
            {splitAntimeridian(flown).map((seg, i) => (
              <Polyline key={`f${i}`} coordinates={seg} strokeColor={C.accent} strokeWidth={4} />
            ))}
            {splitAntimeridian(rest).map((seg, i) => (
              <Polyline
                key={`r${i}`}
                coordinates={seg}
                strokeColor={r.highlight === false ? C.accent + '55' : single ? C.sub : C.accent}
                strokeWidth={single ? 3 : 2}
                lineDashPattern={single ? [6, 6] : undefined}
              />
            ))}
          </View>
        );
      })}
      {[...airports.values()].map((a) => (
        <Marker key={`${a.latitude},${a.longitude}`} coordinate={a} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={st.ap}>
            <View style={st.apDot} />
            {a.code && routes.length < 8 ? <Text style={st.apText}>{a.code}</Text> : null}
          </View>
        </Marker>
      ))}
      {planes.map((p) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.lat, longitude: p.lon }}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => onPlanePress?.(p.id)}
          tracksViewChanges={false}>
          <Text style={[st.plane, { transform: [{ rotate: `${(p.trackDeg ?? 90) - 90}deg` }] }]}>✈</Text>
        </Marker>
      ))}
    </MapView>
  );
}

const st = StyleSheet.create({
  ap: { alignItems: 'center' },
  apDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.bg, borderWidth: 2.5, borderColor: C.text },
  apText: { color: C.text, fontWeight: '800', fontSize: 12, marginTop: 2, textShadowColor: '#000', textShadowRadius: 3 },
  plane: { color: C.accent, fontSize: 26, textShadowColor: '#000', textShadowRadius: 4 },
});
