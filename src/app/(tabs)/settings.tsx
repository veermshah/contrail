import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, T } from '@/components/ui';
import { testKey } from '@/lib/api/aerodatabox';
import { isPast } from '@/lib/flights';
import { cancelAllReminders, ensurePermission, scheduleReminders } from '@/lib/notifications';
import { getApiKey, getPrefs, setApiKey, setPrefs, type Prefs } from '@/lib/settings';
import { getFlights, replaceAll } from '@/lib/store';
import { C, R } from '@/lib/theme';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [prefs, setP] = useState<Prefs>({ units: 'mi', alerts: true });

  useEffect(() => {
    getApiKey().then((k) => setSaved(!!k));
    getPrefs().then(setP);
  }, []);

  const save = async () => {
    setMsg('Checking key…');
    try {
      await testKey(key.trim());
      await setApiKey(key);
      setSaved(true);
      setKey('');
      setMsg('Key saved. Schedules, gates and delays are on.');
    } catch (e: any) {
      setMsg(`That key didn't work: ${e?.message ?? 'unknown error'}`);
    }
  };

  const update = async (p: Partial<Prefs>) => {
    if (p.alerts) await ensurePermission();
    setP(await setPrefs(p));
    if (p.alerts === false) await cancelAllReminders().catch(() => {});
    if (p.alerts) for (const f of getFlights().filter((x) => !isPast(x))) await scheduleReminders(f).catch(() => {});
  };

  const exportData = () => Share.share({ message: JSON.stringify(getFlights(), null, 2) });

  const clear = async () => {
    await replaceAll([]);
    setMsg('All flights removed.');
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={[st.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
      <T variant="title">Settings</T>

      <Card style={{ gap: 10 }}>
        <T variant="label">Flight data</T>
        <T variant="sub">
          Routes and live positions work out of the box. For schedules, delays, gates, airport boards and inbound-plane tracking, add a free AeroDataBox key from RapidAPI.
        </T>
        <T style={{ color: saved ? C.green : C.amber, fontWeight: '700' }}>{saved ? 'AeroDataBox key saved' : 'No key saved'}</T>
        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder="RapidAPI key"
          placeholderTextColor={C.dim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={st.input}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Save key" onPress={save} disabled={!key.trim()} style={{ flex: 1 }} />
          {saved && (
            <Button
              title="Remove"
              kind="ghost"
              onPress={async () => {
                await setApiKey(null);
                setSaved(false);
              }}
            />
          )}
        </View>
        <Button title="Get a free key" kind="ghost" onPress={() => Linking.openURL('https://rapidapi.com/aedbx-aedbx/api/aerodatabox/pricing')} />
        {msg && <T variant="sub">{msg}</T>}
      </Card>

      <Card style={{ gap: 14 }}>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>Flight alerts</T>
            <T variant="sub">Gate changes, delays, check-in and boarding reminders</T>
          </View>
          <Switch value={prefs.alerts} onValueChange={(v) => update({ alerts: v })} trackColor={{ true: C.accent }} />
        </View>
        <View style={st.row}>
          <T style={{ fontWeight: '700', flex: 1 }}>Distance in kilometers</T>
          <Switch value={prefs.units === 'km'} onValueChange={(v) => update({ units: v ? 'km' : 'mi' })} trackColor={{ true: C.accent }} />
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <T variant="label">Your data</T>
        <T variant="sub">Flights are stored only on this device{Platform.OS === 'web' ? ' (browser storage)' : ''}.</T>
        <Button title="Export flights (JSON)" kind="ghost" onPress={exportData} />
        <Button title="Delete all flights" kind="danger" onPress={clear} />
      </Card>

      <T variant="sub" style={{ textAlign: 'center' }}>
        Contrail · Data: AeroDataBox, adsbdb.com, adsb.lol (ODbL)
      </T>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { backgroundColor: C.bg, color: C.text, fontSize: 16, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.line },
});
