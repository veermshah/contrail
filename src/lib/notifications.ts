import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { bestTime } from './format';
import type { Flight } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function notifyNow(title: string, body: string, flightId?: string) {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: flightId ? { flightId } : {} },
    trigger: null,
  });
}

const reminderIds = (id: string) => [`${id}-checkin`, `${id}-leave`, `${id}-board`];

export async function cancelReminders(flightId: string) {
  if (Platform.OS === 'web') return;
  await Promise.all(reminderIds(flightId).map((i) => Notifications.cancelScheduledNotificationAsync(i).catch(() => {})));
}

export async function cancelAllReminders() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleReminders(f: Flight) {
  if (Platform.OS === 'web') return;
  await cancelReminders(f.id);
  const dep = bestTime(f.departure);
  if (!dep) return;
  const depMs = Date.parse(dep);
  const label = `${f.number} ${f.departure.airport.iata ?? ''} → ${f.arrival.airport.iata ?? ''}`.trim();
  const plan: [string, number, string, string][] = [
    [`${f.id}-checkin`, depMs - 24 * 3600e3, `Check in for ${f.number}`, `${label} departs in 24 hours.`],
    [`${f.id}-leave`, depMs - 3 * 3600e3, `${f.number} departs in 3 hours`, `Time to head to ${f.departure.airport.name}.`],
    [`${f.id}-board`, depMs - 40 * 60e3, `${f.number} boards soon`, `Departs in 40 minutes${f.departure.gate ? ` from gate ${f.departure.gate}` : ''}.`],
  ];
  for (const [identifier, at, title, body] of plan) {
    if (at <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, data: { flightId: f.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
  }
}
