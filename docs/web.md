# Web app

React single-page app in `web/`, built with Vite and styled with Tailwind CSS.

## Talking to the server

- The app only calls the server, with relative paths (`/api/...`, `/auth/...`). In dev, Vite forwards them to `localhost:4000` (`vite.config.js`), so there's no `.env` on the web side.
- Every call goes through `web/src/lib/api.ts`, which sends the session cookie (`credentials: 'include'`) and throws on an error status.
- **Google sign-in** is a full-page redirect to `/auth/google`, as OAuth requires. **Passkeys** use `fetch` plus the browser's WebAuthn API (`web/src/lib/webauthn.ts`).

## Data

- **Reading:** TanStack Query, through `useLoad(key, loader)` in `web/src/lib/useLoad.ts`.
  - Cards that read the same key share one request, and `reload()` refreshes every reader of a key.
  - Data refreshes when the tab comes back to the front, and signing out clears the cache.
  - `useMe` and `useWeights` (`web/src/lib/sharedData.ts`) are the two keys most cards read.
- **Writing:** `useSubmit(action, errorMessage)` disables the form while it saves and shows your error message, never raw API text. A `ValidationError` is the exception: its message is written for the user and shown as it is.
- **Shared logic:** food amounts, macros, TDEE, streaks and strength levels live in `shared/` and are used by the Android app too.

## The screen

`Dashboard.tsx` lays out the cards: one column on a phone, two on a desktop. The profile page swaps in through a `view` state; there's no router yet.

| Card | What it does |
| --- | --- |
| `MacroStatsCard` | Today's macros and calories against your targets, and the foods logged under each meal. Food is logged in `LogFoodDialog` (the same steps as the phone), with name search and barcodes in `ProductLookup` and `BarcodeScanner` (ZXing, loaded only when opened). |
| `GettingStarted` | Shown to new users only, until the profile, height and a weight exist (`shared/src/onboarding.ts`). |
| `WeightChart` | Weight and body fat charts, BMI, goals, and the first measurements form. |
| `TrainingLogCard` | Routine, weekly streak, the month calendar (`TrainingCalendar`) and sessions (`SessionEditor`). |
| `BigFourCard` | The four lifts, ranked, with charts, goals and strength levels. |
| `ProfileSecurityPage` | Profile fields and passkeys. |
| `Footer` | Version and credits. The shared credits are in `shared/src/about.ts`. |

## Conventions

- **Tailwind only.** No per-component CSS. The one exception is `web/src/index.css`, which holds the background, because a multi-stop `mask-image` can't be written as utilities.
- **Manrope** is self-hosted (`@fontsource-variable/manrope`), so no request goes to Google Fonts.
- **Tests cover logic, not components:** `shared/src/` and `web/src/lib/`. Logic worth testing belongs there, not inside a component.
- **Metric only:** the database stores kg and cm.
- In dev, React StrictMode runs every effect twice, so the network tab shows double the requests a production build makes.
