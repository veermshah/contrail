import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { greatCircle, regionFor, unwrapPath } from '@/lib/geo';
import { C } from '@/lib/theme';

import type { FlightMapProps } from './map-types';


export default function FlightMap({ routes, planes = [], center, style }: FlightMapProps) {
  const [size, setSize] = useState({ w: 400, h: 300 });
  const W = size.w, H = size.h;
  const paths = useMemo(() => routes.map((r) => ({ r, path: unwrapPath(greatCircle(r.from, r.to)) })), [routes]);
  const reg = useMemo(() => {
    if (center) return { latitude: center.latitude, longitude: center.longitude, latitudeDelta: center.radiusDeg * 2, longitudeDelta: center.radiusDeg * 2 };
    const pts = paths.flatMap((p) => p.path);
    planes.forEach((p) => pts.push({ latitude: p.lat, longitude: p.lon }));
    return pts.length ? regionFor(pts) : { latitude: 30, longitude: -40, latitudeDelta: 100, longitudeDelta: 160 };
  }, [paths, planes, center]);
  const span = Math.max(reg.longitudeDelta, (reg.latitudeDelta * W) / H);
  const x = (lon: number) => ((lon - reg.longitude) / span + 0.5) * W;
  const y = (lat: number) => (0.5 - ((lat - reg.latitude) * W) / H / span) * H;
  const step = span > 60 ? 15 : span > 20 ? 5 : 1;
  const grid: number[] = [];
  for (let v = -180; v <= 180; v += step) grid.push(v);

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: '#0C1424' }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ w: width, h: height });
      }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {grid.map((g) => (
          <Line key={`x${g}`} x1={x(g)} x2={x(g)} y1={0} y2={H} stroke={C.line} strokeWidth={0.5} />
        ))}
        {grid.filter((g) => Math.abs(g) <= 90).map((g) => (
          <Line key={`y${g}`} y1={y(g)} y2={y(g)} x1={0} x2={W} stroke={C.line} strokeWidth={0.5} />
        ))}
        {paths.map(({ r, path }) => (
          <Polyline key={r.id} points={path.map((p) => `${x(p.longitude)},${y(p.latitude)}`).join(' ')} fill="none" stroke={C.accent} strokeWidth={2} />
        ))}
        {paths.flatMap(({ r, path }) => [{ ...r.from, longitude: path[0].longitude }, { ...r.to, longitude: path[path.length - 1].longitude }]).map((a, i) => (
          <Circle key={i} cx={x(a.longitude)} cy={y(a.latitude)} r={4} fill={C.bg} stroke={C.text} strokeWidth={2} />
        ))}
        {routes.length < 8 &&
          paths.flatMap(({ r, path }) => [{ ...r.from, longitude: path[0].longitude }, { ...r.to, longitude: path[path.length - 1].longitude }]).map((a, i) =>
            a.code ? (
              <SvgText key={`t${i}`} x={x(a.longitude)} y={y(a.latitude) + 16} fill={C.text} fontSize={11} fontWeight="800" textAnchor="middle">
                {a.code}
              </SvgText>
            ) : null
          )}
        {planes.map((p) => (
          <SvgText key={p.id} x={x(p.lon)} y={y(p.lat) + 6} fill={C.accent} fontSize={18} textAnchor="middle" transform={`rotate(${(p.trackDeg ?? 90) - 90} ${x(p.lon)} ${y(p.lat)})`}>
            ✈
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
