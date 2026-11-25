import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { C } from '@/lib/theme';

function icon(g: string) {
  return function TabIcon({ color }: { color: any }) {
    return <Text style={{ color, fontSize: 18 }}>{g}</Text>;
  };
}

export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: C.accent, tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line } }}>
      <Tabs.Screen name="index" options={{ title: 'Flights', tabBarIcon: icon('✈') }} />
      <Tabs.Screen name="live" options={{ title: 'Overhead', tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="passport" options={{ title: 'Passport', tabBarIcon: icon('◍') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
