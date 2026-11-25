import { Pressable, StyleSheet, Text, View, type PressableProps, type TextProps, type ViewProps } from 'react-native';

import { C, R } from '@/lib/theme';

export function Card({ style, ...p }: ViewProps) {
  return <View {...p} style={[s.card, style]} />;
}

export function T({ style, variant = 'body', ...p }: TextProps & { variant?: keyof typeof s }) {
  return <Text {...p} style={[s[variant] as any, style]} />;
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.pill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[s.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  kind = 'primary',
  style,
  ...p
}: PressableProps & { title: string; kind?: 'primary' | 'ghost' | 'danger'; style?: any }) {
  return (
    <Pressable
      {...p}
      style={({ pressed }) => [
        s.btn,
        kind === 'primary' && { backgroundColor: C.accent },
        kind === 'ghost' && { backgroundColor: C.cardHi },
        kind === 'danger' && { backgroundColor: C.red + '22' },
        (pressed || p.disabled) && { opacity: 0.6 },
        style,
      ]}>
      <Text style={[s.btnText, { color: kind === 'primary' ? C.bg : kind === 'danger' ? C.red : C.text }]}>{title}</Text>
    </Pressable>
  );
}

export function KV({ k, v, color }: { k: string; v?: string | number | null; color?: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={[s.kvV, color ? { color } : null]}>{v ?? '—'}</Text>
    </View>
  );
}

export function Progress({ value, color = C.accent }: { value: number; color?: string }) {
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
      <View style={[s.dot, { left: `${Math.round(value * 100)}%`, borderColor: color }]} />
    </View>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  body: { color: C.text, fontSize: 15 },
  sub: { color: C.sub, fontSize: 13 },
  label: { color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: C.text, fontSize: 18, fontWeight: '700' },
  code: { color: C.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  big: { color: C.text, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  btn: { borderRadius: R.md, paddingVertical: 14, alignItems: 'center', paddingHorizontal: 16 },
  btnText: { fontSize: 16, fontWeight: '700' },
  kv: { flex: 1, minWidth: 90, gap: 2 },
  kvK: { color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  kvV: { color: C.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: C.line, marginVertical: 8 },
  fill: { height: 4, borderRadius: 2 },
  dot: { position: 'absolute', top: -4, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: C.bg, borderWidth: 3 },
});
