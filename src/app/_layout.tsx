import * as Notifications from 'expo-notifications';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerBackgroundRefresh } from '@/lib/background';
import { ensurePermission } from '@/lib/notifications';
import { loadFlights } from '@/lib/store';
import { C } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.text, primary: C.accent, border: C.line },
};

export default function RootLayout() {
  useEffect(() => {
    loadFlights().finally(() => SplashScreen.hideAsync());
    registerBackgroundRefresh().catch(() => {});
    ensurePermission().catch(() => {});
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = r.notification.request.content.data?.flightId;
      if (typeof id === 'string') router.push({ pathname: '/flight/[id]', params: { id } });
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerTintColor: C.accent, headerStyle: { backgroundColor: C.bg }, headerTitleStyle: { color: C.text }, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Add flight' }} />
        <Stack.Screen name="flight/[id]" options={{ title: '', headerTransparent: true, headerBackTitle: 'Flights' }} />
        <Stack.Screen name="airport/[code]" options={{ title: 'Airport' }} />
      </Stack>
    </ThemeProvider>
  );
}
