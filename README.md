# Gainz.Tracker

A personal weight, calorie/macro, and workout-routine tracker. This is the frontend (React SPA); the backend lives in [server/](server/README.md) and has its own README covering the auth/data architecture.

This README is more of a working plan than a finished description — update it as things land instead of leaving it aspirational.

## Where things actually stand

**Built:**

- Real Google sign-in (`src/components/Login.jsx`) — hands off to the BFF, no fake auth.
- Passkey (WebAuthn) sign-in as a second, passwordless option — `src/lib/webauthn.js` wraps the registration/authentication ceremonies; see [server/README.md](server/README.md) for how the crypto side works. Passkeys are managed (added/removed) from the Dashboard.
- `App.jsx` checks session state on load (`/api/me`) and switches between Login/Dashboard. Exposes a `checkAuth`/`onAuthenticated` callback so an in-page login (passkey) can re-check auth state without a page reload, the way a full-page redirect (Google) naturally would.
- `src/lib/api.js` — a small fetch wrapper for talking to the BFF (always sends cookies, throws on non-2xx).
- Mobile-first Tailwind design system (`#053345`/`#808F85`/`#DCE0D9`, wireframe-gradient background) applied consistently across every screen.
- **`MacroStatsCard.jsx`** — today's protein/fat/carbs as lifebars against a personal target (editable inline, with the calorie field auto-suggested from the macros via Atwater factors — 4/4/9 — but always overridable), a `g`/`Cal`/`%` display toggle that only changes what's shown, never the bar's fill math, a "Total calories" bar (only once a calorie target exists), and inline food logging with a traceable list of today's entries (each removable).
- **`WeightChart.jsx`** — weight and body-fat progression (via the shared `StatLineChart.jsx`), inline weight logging (with optional body fat %), a one-time editable height, a derived BMI (never stored — computed from the latest weight entry + height each render), weight/body-fat goals shown as a chart reference line, a "both" mode that stacks the two as aligned panels (never one dual-axis chart), and a 1W–1M–3M–6M–1Y–All range picker (defaults to 1Y) that filters client-side against the already-fetched entries. X-axis ticks only grow a year suffix ("Sep '26") when the visible range actually spans more than one calendar year.
- **`RoutineCard.jsx`** + **`TrainingLogCard.jsx`** — a training split (e.g. "6-Day PPL") as a rotating cycle of day-type labels (`src/lib/templates.js` holds five named presets, plus a custom builder), not tied to calendar weekdays. Logging is an explicit yes/no per scheduled day (`src/lib/splits.js`), capped at one log per calendar day (enforced server-side, not just in the UI — see `server/README.md`), and the streak counts consecutive completed days — skipping still advances the cycle so a day can't be dodged forever. History is a real month calendar (`TrainingCalendar.jsx`), not a flat list — click a logged day to see what it was and remove it, which is also how you correct today's entry once it's already logged. Split into two cards deliberately: routine setup is rare, daily logging is frequent.
- **`BigFourCard.jsx`** — logs squat/deadlift/bench/overhead press via the existing (previously unused) `/api/workout-sets`, ranks the four by each lift's most recent weight, and charts progression per lift (also via `StatLineChart.jsx`) against an optional goal. `src/lib/strength.js` classifies each lift into Beginner/Novice/Intermediate/Advanced/Elite from a bodyweight-ratio table (male/female), shown as a small icon — needs a logged bodyweight and `sex` set, both optional, and silently omits the rating rather than guessing when either is missing.
- **`ProfileSecurityPage.jsx`** — full profile (avatar/name/email), the `sex` toggle (male/female — only feeds the Big 4 strength rating, nothing else reads it), and passkey management, all pulled off the dashboard onto a separate screen reached via a compact top bar. Deliberately not one tap away on the page you land on every visit, since adding a sign-in credential is security-sensitive.
- `Dashboard.jsx` composes the cards above into a `grid grid-cols-1 lg:grid-cols-2` — single column on mobile, 2-up on desktop — plus the compact profile bar and a `view` state (`dashboard`/`profile`) that swaps the page content in place of real routing (see Open questions below).

**Not built yet:** the original `WorkoutRoutine`/`WorkoutSet` model's `exercises`/target-sets/reps fields have no frontend beyond the flat `exerciseName`/`weightKg`/`reps` shape the Big 4 card uses — full routine-linked exercise tracking (e.g. a split day-label pointing at a real exercise list) is still the natural extension point described below.

## Why React + Vite + Tailwind

Kept deliberately boring: Vite for fast dev/build with no framework opinions forced on us (no server rendering, no file-based routing we don't need for what's currently a single authenticated app, not a public site), React because it's the most transferable choice for a learning project, Tailwind for styling so we're not hand-rolling CSS files per component as the app grows.

Every component uses Tailwind utility classes exclusively — no per-component CSS files. The one exception is `src/index.css`, which holds the Tailwind import plus `.app-background` (the shared wireframe-grid/gradient background), since a `mask-image` with multi-stop gradients isn't expressible as Tailwind utilities. **Whatever component is built next should stay Tailwind-only**, so this doesn't drift back into mixed approaches.

## How the frontend talks to the backend

The SPA never touches Google, tokens, or the database directly — it only calls the BFF (see `server/`) via relative paths (`/api/...`, `/auth/...`), which the Vite dev server proxies to `localhost:4000` (config in `vite.config.js`). This means:

- No `.env` is needed on the frontend in dev — there's nothing to configure, the proxy makes everything same-origin.
- Every call needs `credentials: 'include'` so the session cookie actually gets sent — `src/lib/api.js` does this automatically, so new code should go through that helper rather than calling `fetch` directly.
- Google login is a full-page navigation (`window.location.href = '/auth/google'`), not a `fetch` call — that's an OAuth requirement, not a frontend choice, and should stay that way if this ever gets a second SSO provider. Passkey login/registration, by contrast, are `fetch`-based (`src/lib/webauthn.js`) since WebAuthn ceremonies run via the browser's `navigator.credentials` API, not a redirect.

## Planned feature build-out

1. **Exercise-level tracking within a training day** — the remaining gap. The routine-split feature tracks adherence ("did you do Push day"), not what you actually did in it. Linking a split's day-label to a real `WorkoutRoutine` (exercise list) and logging actual `WorkoutSet` rows (weight/reps) would sit underneath the existing streak feature, not replace it. Backend already exists for this: `/api/workouts` + `/api/workout-sets`, both still unused by any frontend.

## Open questions to decide before/while building the above

These are real open decisions, not settled defaults — flagging them here so they get made deliberately instead of by accident:

- **Routing.** `Dashboard.jsx` now has two "pages" (dashboard/profile) via a plain `view` state, not `react-router-dom` — a URL toggle would need one more screen or an actual need for a bookmarkable/shareable URL or back-button support before it's worth the dependency.
- **Client state / data fetching.** Every card (`MacroStatsCard`, `WeightChart`, `RoutineCard`, `TrainingLogCard`, passkeys) independently does its own manual `fetch` + `useState` + a `load()` refetch-after-mutation. `RoutineCard`/`TrainingLogCard` were the first case where one card's change (creating a routine) needed to be reflected in a sibling (the training log) — solved for now with a simple parent-owned counter passed down as a prop (`Dashboard.jsx`'s `splitVersion`), not a data-fetching library. If a third card ever needs this kind of cross-card coordination, that's the point to revisit reaching for something like TanStack Query instead of adding more one-off counters.
- **Units.** The backend schema is metric-only (`weightKg`, `heightCm`). If imperial units matter, that's a backend + frontend decision to make together — now that real weight/height data exists, retrofitting a unit system means a migration choice (convert stored data vs. store a unit preference), not just a frontend formatting change.

## Running locally

This only runs meaningfully against the BFF — see [server/README.md](server/README.md) for the full backend setup (Postgres + Google OAuth credentials). Once that's running on `:4000`:

```bash
npm install
npm run dev      # starts on :5173, proxies /api and /auth to :4000
```

`npm run lint` and `npm run build` both work standalone without the backend running (they don't need a live connection), and are worth running before committing — `eslint.config.js` explicitly excludes `server/` since that's a Node app, not a browser one, and gets its own conventions.
