# Contrail

An original personal flight tracker built with React Native + Expo (SDK 58, Expo Router).

## Features
- Add flights by number and date; route lookup works with no API key (adsbdb.com)
- Live aircraft position, altitude, speed and heading (adsb.lol)
- Schedules, delays, gates, terminals, baggage belts and airport departure/arrival boards (AeroDataBox, optional key)
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

To enable schedules, delays and gates, subscribe to the free Basic plan of
[AeroDataBox on RapidAPI](https://rapidapi.com/aedbx-aedbx/api/aerodatabox/pricing) and paste the key in Settings.
The key is stored on-device in the iOS Keychain (expo-secure-store).

## Checks
```bash
npx tsc --noEmit && npx expo lint && npx expo-doctor
```

Data: AeroDataBox, adsbdb.com, adsb.lol (ODbL).
