import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Flight } from './types';

const KEY = 'contrail:flights';
let flights: Flight[] = [];
let loaded = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(flights));

export async function loadFlights() {
  if (loaded) return flights;
  const raw = await AsyncStorage.getItem(KEY);
  flights = raw ? JSON.parse(raw) : [];
  loaded = true;
  emit();
  return flights;
}

export const getFlights = () => flights;
export const getFlight = (id: string) => flights.find((f) => f.id === id);

export async function upsertFlight(f: Flight) {
  const i = flights.findIndex((x) => x.id === f.id);
  flights = i >= 0 ? flights.map((x) => (x.id === f.id ? f : x)) : [...flights, f];
  emit();
  await persist();
}

export async function removeFlight(id: string) {
  flights = flights.filter((f) => f.id !== id);
  emit();
  await persist();
}

export async function replaceAll(next: Flight[]) {
  flights = next;
  emit();
  await persist();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useFlights() {
  return useSyncExternalStore(subscribe, getFlights, getFlights);
}

export function useFlight(id: string) {
  const all = useFlights();
  return all.find((f) => f.id === id);
}
