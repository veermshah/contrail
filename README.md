# Contrail

An original personal flight tracker built with React Native + Expo (SDK 58, Expo Router).

## Features
- Add flights by number and date; route lookup works with no API key (adsbdb.com)
- Live aircraft position, altitude, speed and heading (adsb.lol)
- Airport boards of recent takeoffs/landings (OpenSky, no key) and scheduled times from calendar-imported flights (no key)
- Optional: gates, terminals, official delays and baggage belts with an AeroDataBox key
- "Where's my plane?" inbound-aircraft tracking by tail number
- Delay / gate-change alerts and check-in, leave-for-airport and boarding reminders
- Overhead radar: planes near you within 30 nm
- Passport: lifetime distance, flight time, airports, airlines, countries, aircraft, on-time rate
- Local-only storage with JSON export

## Run
```bash
npm install
npx expo start --tunnel   # scan the QR with the iPhone Camera, opens in Expo Go
```

No API key is needed. Optionally, an [AeroDataBox](https://rapidapi.com/aedbx-aedbx/api/aerodatabox/pricing) key in
Settings → Advanced adds gates, terminals, official delays and inbound-plane tracking.
The key is stored on-device in the iOS Keychain (expo-secure-store).

## Checks
```bash
npx tsc --noEmit && npx expo lint && npx expo-doctor
```

Data: AeroDataBox, adsbdb.com, adsb.lol (ODbL).
