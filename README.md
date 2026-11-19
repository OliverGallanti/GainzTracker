# Gainz.Tracker

Track what you eat, what you weigh and how you train, in one place: a web app and an Android app that share one account and one server.

**Live:** <https://gainztracker-p8dw.onrender.com> · **Version:** 1.1.0

## Features

### Food and macros

- **Daily targets at a glance:** protein, fat, carbs and calories as progress bars, shown in grams, calories or percent.
- **Help setting targets:** an estimate of your maintenance calories from your profile, one-tap Cut, Maintain or Bulk, and a suggested protein, fat and carb split. It's deliberately careful (a calorie floor, no cutting for under-18s) and says it's general guidance, not medical advice.
- **Log food in a few steps:** pick a saved food, search the [Open Food Facts](https://world.openfoodfacts.org) database by name, scan or type a barcode, or enter the values yourself. Then say how much you ate, in grams or servings, and see what it comes to.
- **Your own meals:** foods are grouped under meals you name and order yourself (Breakfast, Lunch, Dinner, Dessert…), each with its subtotal. Tap a logged food to change or delete it.
- **My foods:** foods you save, with values per serving or per 100 g, searchable, most recently used first.
- **Past days:** step back a day at a time, or pick one on a calendar that shows the days with food, then see or fill in what you ate.

### Weight and body

- **Weight and body fat:** log them on any day from a calendar, edit or remove them, see your BMI, and follow both on charts over the range you choose, up to all time, with your goals drawn on them.

### Training

- **Your routine:** start from a template (6-Day PPL, Upper/Lower and others) or name your own days, and set how many days a week make a good week.
- **A month calendar:** mark each day done or skipped; any past day can be filled in later. Give each day of your routine its own colour and icon.
- **Weekly streak:** how many weeks in a row you hit your goal. Switching routines doesn't reset it.
- **Sessions:** the exercises of a day, with kg, reps, sets and how long it took.
- **Live workout (Android):** start and finish each set on a timer, with a rest clock that tells you when to go again. A new session is filled in from the last time you trained that day.

### Big 4

- **Squat, bench press, deadlift and overhead press:** log a lift (with optional RPE, how hard it was), see them ranked by your latest lift, and follow each on a chart towards your goal.
- **Strength level:** where each lift stands, from Novice to Elite, for your bodyweight and sex.

### Account

- **Sign in with Google**, or on the web with a passkey (fingerprint, face or security key, no password).
- **Profile:** sex, age, activity level, height and goals, which the calorie estimate and strength levels use.
- **Delete your account:** from the profile, on the web or the phone. Everything is erased at once.

### Web and Android

Both apps cover everything above, with a few differences:

| | Web | Android |
| --- | --- | --- |
| Live workout with set and rest timers | | ✓ |
| Works offline (shows saved data, sends what you log when you reconnect) | | ✓ |
| Passkey sign-in and managing passkeys | ✓ | |
| Renaming and reordering meals | ✓ | |

## Why it exists

- **One place for the daily stuff.** Food, weight and training together, instead of three apps.
- **One codebase, two apps.** The web and Android apps share their logic and API types (`shared/`), so a rule like the weekly streak or the macro maths is written once.
- **Free and offline-friendly.** It runs on free hosting (Render and Neon). The Android app opens on saved data with no signal and sends what you log once it's back online.

## How it's built

One repo with npm workspaces:

| Folder | What it is | Built with |
| --- | --- | --- |
| `web/` | The web app | React, Vite, Tailwind CSS, TanStack Query |
| `mobile/` | The Android app | Expo, React Native, TanStack Query |
| `server/` | The API, which also serves the web app in production | Fastify, Prisma, PostgreSQL, Zod |
| `shared/` | Logic and types both apps use | Plain TypeScript, no build step |

- **Web:** a single-page app that only talks to the server (`/api`, `/auth`) with a session cookie, never to Google or the database. More in [docs/web.md](docs/web.md).
- **Android:** native Google sign-in, with the token kept in the phone's keystore. Data is saved on the phone, writes wait in a queue while offline, and new versions arrive over the air (EAS Update) without a new APK. More in [docs/mobile.md](docs/mobile.md).
- **Server:** a backend-for-frontend that handles Google sign-in and passkeys, scopes every query to the signed-in user, and rate-limits sign-in and food lookups. More in [server/README.md](server/README.md).

## Run it locally

You need Node 24, a Postgres database (`docker compose up -d` starts one) and a Google OAuth client. [server/README.md](server/README.md#running-locally) shows how to fill in `server/.env`.

```bash
npm install            # once, for every workspace
npm run dev:server     # API on :4000
npm run dev:web        # web app on :5173, forwards /api and /auth to :4000
```

The Android app needs a development build. See [docs/mobile.md](docs/mobile.md#build-and-run).

Before committing: `npm run lint`, `npm run typecheck` and `npm test`. The server's route tests run against a separate `*_test` database and are skipped when there's no local Postgres.

## Deploy and release

The live site is one Render web service (API and web app together) with a Neon Postgres database. GitHub Actions runs lint, typecheck, tests and the build on every push. Web, server and Android share one version number. Setup and release steps are in [docs/development.md](docs/development.md).

## Credits

Made by Oliver Gallanti · [Portfolio](https://olivergallanti.vercel.app/) · [LinkedIn](https://www.linkedin.com/in/olivergallanti/)

- **Food data:** [Open Food Facts](https://world.openfoodfacts.org), community-edited, under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
- **Web:** [React](https://react.dev), [Vite](https://vite.dev), [Tailwind CSS](https://tailwindcss.com), [TanStack Query](https://tanstack.com/query), [Recharts](https://recharts.org), [ZXing](https://github.com/zxing-js/library) (barcode scanning)
- **Android:** [React Native](https://reactnative.dev), [Expo](https://expo.dev)
- **Server:** [Fastify](https://fastify.dev), [Prisma](https://www.prisma.io), [PostgreSQL](https://www.postgresql.org), [Zod](https://zod.dev), [SimpleWebAuthn](https://simplewebauthn.dev) (passkeys)
- **Both apps:** [Lucide](https://lucide.dev) icons, [Manrope](https://fonts.google.com/specimen/Manrope) typeface
