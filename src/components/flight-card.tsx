import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { fmtDate, fmtDuration, fmtTime } from "@/lib/format";
import { progress } from "@/lib/flights";
import { summarize } from "@/lib/summary";
import { C, R } from "@/lib/theme";
import type { Flight, Movement } from "@/lib/types";

import { Pill, T } from "./ui";

export function AirlineBadge({
  code,
  size = 32,
}: {
  code?: string;
  size?: number;
}) {
  return (
    <View
      style={[st.badge, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <T style={{ color: C.text, fontWeight: "800", fontSize: size * 0.36 }}>
        {code ?? "✈"}
      </T>
    </View>
  );
}

export function RouteLine({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label?: string;
}) {
  const pct = `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%` as const;
  return (
    <View style={st.routeWrap}>
      {label ? <T style={st.routeLabel}>{label}</T> : null}
      <View style={st.routeTrack}>
        <View style={st.dash} />
        <View style={[st.routeFill, { width: pct, backgroundColor: color }]} />
        <T style={[st.plane, { left: pct, color: value > 0 ? color : C.sub }]}>
          ✈
        </T>
      </View>
    </View>
  );
}

function Time({
  m,
  tz,
  delay,
  align,
}: {
  m: Movement;
  tz?: string;
  delay: number;
  align: "left" | "right";
}) {
  const best = m.runwayUtc ?? m.revisedUtc ?? m.predictedUtc ?? m.scheduledUtc;
  const late = delay >= 15;
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <T style={[st.time, { color: late ? C.amber : C.text }]}>
        {fmtTime(best, tz)}
      </T>
      {late && m.scheduledUtc ? (
        <T style={st.struck}>{fmtTime(m.scheduledUtc, tz)}</T>
      ) : null}
    </View>
  );
}

export function FlightCard({
  flight: f,
  compact,
}: {
  flight: Flight;
  compact?: boolean;
}) {
  const sm = summarize(f);
  const p = progress(f);
  const depTz = f.departure.airport.timeZone,
    arrTz = f.arrival.airport.timeZone;
  const color = f.source === "route" ? C.accent : sm.color;
  const dur =
    sm.depTime && sm.arrTime
      ? (Date.parse(sm.arrTime) - Date.parse(sm.depTime)) / 60000
      : 0;
  return (
    <Link href={{ pathname: "/flight/[id]", params: { id: f.id } }} asChild>
      <Pressable
        style={({ pressed }) =>
          pressed && { transform: [{ scale: 0.985 }], opacity: 0.9 }
        }
      >
        <View style={st.card}>
          <LinearGradient
            colors={[color + "26", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={st.row}>
            <View style={[st.row, { gap: 10, flexShrink: 1 }]}>
              <AirlineBadge code={f.number.match(/^[A-Z0-9]{2}/)?.[0]} />
              <View style={{ flexShrink: 1 }}>
                <T style={{ fontWeight: "800", fontSize: 15 }}>
                  {f.number.replace(/^([A-Z0-9]{2})(\d)/, "$1 $2")}
                </T>
                <T variant="sub" numberOfLines={1}>
                  {f.airline?.name ?? "Flight"}
                </T>
              </View>
            </View>
            <T variant="sub" style={{ fontWeight: "600" }}>
              {sm.depTime ? fmtDate(sm.depTime, depTz) : f.dateLocal}
            </T>
          </View>

          <View style={[st.row, { alignItems: "flex-end" }]}>
            <View style={{ flex: 1 }}>
              <T style={st.code}>
                {f.departure.airport.iata ?? f.departure.airport.icao ?? "???"}
              </T>
              <T variant="sub" numberOfLines={1}>
                {f.departure.airport.city ?? f.departure.airport.name}
              </T>
            </View>
            <View style={{ flex: 1.2, paddingBottom: 18 }}>
              <RouteLine
                value={p}
                color={color}
                label={dur > 0 ? fmtDuration(dur) : undefined}
              />
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <T style={st.code}>
                {f.arrival.airport.iata ?? f.arrival.airport.icao ?? "???"}
              </T>
              <T variant="sub" numberOfLines={1}>
                {f.arrival.airport.city ?? f.arrival.airport.name}
              </T>
            </View>
          </View>

          {!compact && (sm.depTime || sm.arrTime) && (
            <View style={st.row}>
              <Time m={f.departure} tz={depTz} delay={sm.dDep} align="left" />
              <Time m={f.arrival} tz={arrTz} delay={sm.dArr} align="right" />
            </View>
          )}

          <View style={[st.row, st.footer]}>
            <View style={[st.row, { gap: 8, flexShrink: 1 }]}>
              <View style={[st.dot, { backgroundColor: color }]} />
              <T style={{ fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>
                {sm.headline}
              </T>
            </View>
            <Pill
              label={sm.tag}
              color={f.source === "route" ? C.sub : sm.color}
            />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 18,
    gap: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: C.cardHi,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  code: {
    color: C.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  time: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  struck: {
    color: C.dim,
    fontSize: 13,
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
  routeWrap: { alignItems: "center", gap: 6, paddingHorizontal: 6 },
  routeLabel: { color: C.sub, fontSize: 12, fontWeight: "600" },
  routeTrack: { alignSelf: "stretch", height: 16, justifyContent: "center" },
  dash: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.dim,
  },
  routeFill: { position: "absolute", left: 0, height: 2, borderRadius: 1 },
  plane: { position: "absolute", marginLeft: -8, fontSize: 15, top: -1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingTop: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
