import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_NAME = 'aerodatabox_rapidapi_key';
const PREFS = 'contrail:prefs';

export type Prefs = { units: 'mi' | 'km'; alerts: boolean };
const DEFAULT_PREFS: Prefs = { units: 'mi', alerts: true };

let cachedKey: string | null | undefined;

export async function getApiKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  cachedKey =
    Platform.OS === 'web' ? await AsyncStorage.getItem(KEY_NAME) : await SecureStore.getItemAsync(KEY_NAME);
  return cachedKey;
}

export async function setApiKey(key: string | null) {
  cachedKey = key && key.trim() ? key.trim() : null;
  if (Platform.OS === 'web') {
    if (cachedKey) await AsyncStorage.setItem(KEY_NAME, cachedKey);
    else await AsyncStorage.removeItem(KEY_NAME);
    return;
  }
  if (cachedKey) await SecureStore.setItemAsync(KEY_NAME, cachedKey);
  else await SecureStore.deleteItemAsync(KEY_NAME);
}

export async function getPrefs(): Promise<Prefs> {
  const raw = await AsyncStorage.getItem(PREFS);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

export async function setPrefs(p: Partial<Prefs>) {
  const next = { ...(await getPrefs()), ...p };
  await AsyncStorage.setItem(PREFS, JSON.stringify(next));
  return next;
}
