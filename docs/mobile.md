# Android app

An Expo (React Native) app in `mobile/`. It uses the same server and the same `shared/` logic as the web app.

## Screens

Five tabs, which you can tap or swipe between (`mobile/src/Tabs.tsx`):

- **Today:** macros, targets, and foods by meal. Food is logged step by step (`LogFoodForm.tsx`); barcodes are scanned with `expo-camera`.
- **Weight:** latest weight, BMI, a chart, and the history.
- **Training:** streak, weekly goal, the month calendar, sessions, and the live workout (`LiveWorkout.tsx`, state in `workout.ts`).
- **Big 4:** the four lifts with charts, goals and strength levels.
- **Profile:** profile fields, sign out, and About (version, running update, "Check for updates", credits).

Shared controls are in `mobile/src/ui.tsx`. Icons are imported one by one in `icons.ts`, because Metro doesn't tree-shake.

## Sign-in

Native Google Sign-In returns an ID token. The server swaps it for a Bearer token, which the app keeps in the device keystore (`expo-secure-store`). See "Mobile login" in [server/README.md](../server/README.md).

## Offline

- **Reads:** every query result is saved on the phone (AsyncStorage, through TanStack Query's persister). The app opens on saved data and refreshes behind it, under an "Offline" banner when there's no signal (`mobile/src/offline.ts`). Saved data older than 30 days is dropped; bump `CACHE_VERSION` when a response shape changes.
- **Writes:** logging, editing and removing go through a queue (`mobile/src/queue.ts`).
  - Offline, a write shows up on screen straight away and waits.
  - Queued writes are sent in the order they were made, and survive the app closing.
  - Each one carries an id made on the phone, so a retry can never create a duplicate.
  - The header shows "Waiting to sync (N)". A write the server refuses gets Retry and Dismiss.
  - `queue.test.ts` tests the queue against a fake network and a simulated restart.

## Build and run

Google Sign-In needs native code, so the app runs in a development build, not Expo Go.

- **Config:** `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (the server's *web* OAuth client id). Cloud builds read them from `eas.json`, local builds from `mobile/.env.local` (point the URL at your PC's LAN address to use the local server).
- **Google Cloud:** you need an OAuth client of type Android for each signing key, with package `com.olivergallanti.gainztracker` and that key's SHA-1.
- **Local build:** `npm run android -w mobile`, with the phone plugged in and USB debugging on.
- **Cloud build:** `npx eas-cli build -p android --profile preview` makes a standalone APK. `mobile/android` is generated and gitignored.
- **Windows:** `react-native-svg`'s native build breaks when the repo sits in a deep folder (paths over 260 characters). Build from a short path such as `C:\gt`.
- **Signing:** Android only updates an app with one signed by the same key. A local build and an EAS build can't replace each other, so uninstall first.

## Updates without a new APK

- `npm run update -w mobile -- "what changed"` publishes the JavaScript to the `preview` channel. Phones download it on launch and run it from the next launch, or right away with Profile → About → "Check for updates".
- An update only reaches APKs with the same native code (`runtimeVersion.policy: fingerprint`). After a native change (a new native module, or `app.json` plugins, permissions, icons or fonts), build a new APK first. `npx expo-updates runtimeversion:resolve --platform android` shows the current fingerprint.
- The `EXPO_PUBLIC_*` values for updates come from the EAS `preview` environment. Keep them the same as `eas.json`.

## Details worth knowing

- **Splash:** the system splash is a still logo. `AnimatedSplash` in `App.tsx` draws the same logo at the same size, then fades into the app. Keep the two sizes equal.
- **Barcode scanning** needs `expo-camera` 58.0.13 or later, because earlier versions break it in release builds.
- **No Google Sign-In config plugin:** Android without Firebase doesn't need one.
