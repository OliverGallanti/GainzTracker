# GainzTracker

A personal weight, calorie/macro, and workout-routine tracker. This is the frontend (React SPA); the backend lives in [server/](server/README.md) and has its own README covering the auth/data architecture.

This README is more of a working plan than a finished description — the app is genuinely just a login screen right now, and most of what's below is "what we're building toward" rather than "what exists." Update it as things land instead of leaving it aspirational.

## Where things actually stand

**Built:**

- Real Google sign-in (`src/components/Login.jsx`) — hands off to the BFF, no fake auth.
- A placeholder `Dashboard.jsx` that shows who's logged in and a working logout.
- `App.jsx` checks session state on load (`/api/me`) and switches between Login/Dashboard.
- `src/lib/api.js` — a small fetch wrapper for talking to the BFF (always sends cookies, throws on non-2xx).

**Not built at all yet:** any actual tracking UI. The backend already has working, authenticated CRUD endpoints for weight entries, macro/calorie entries, and workout routines/sets (see [server/README.md](server/README.md)) — there is simply no frontend for any of it. That's the next phase of work, not a future maybe.

## Why React + Vite + Tailwind

Kept deliberately boring: Vite for fast dev/build with no framework opinions forced on us (no server rendering, no file-based routing we don't need for what's currently a single authenticated app, not a public site), React because it's the most transferable choice for a learning project, Tailwind for styling so we're not hand-rolling CSS files per component as the app grows.

**Note on current inconsistency**: `Login.jsx` still uses a hand-written `Login.css`, and `Dashboard.jsx` uses inline `style={}` — neither uses Tailwind yet, even though it's installed (`src/index.css` just does `@import "tailwindcss"`). This wasn't a decision, it's just that nothing past the login screen has been built with real UI intent yet. **Whatever component is built next should use Tailwind**, and `Login.jsx` should get migrated when it's next touched, so we don't end up with three different styling approaches in one app.

## How the frontend talks to the backend

The SPA never touches Google, tokens, or the database directly — it only calls the BFF (see `server/`) via relative paths (`/api/...`, `/auth/...`), which the Vite dev server proxies to `localhost:4000` (config in `vite.config.js`). This means:

- No `.env` is needed on the frontend in dev — there's nothing to configure, the proxy makes everything same-origin.
- Every call needs `credentials: 'include'` so the session cookie actually gets sent — `src/lib/api.js` does this automatically, so new code should go through that helper rather than calling `fetch` directly.
- Login/logout are full-page navigations (`window.location.href = '/auth/google'`), not `fetch` calls — that's an OAuth requirement, not a frontend choice, and should stay that way if this ever gets a second SSO provider.

## Planned feature build-out

Roughly in the order it makes sense to build, since each one is a fairly self-contained CRUD screen against an endpoint that already exists server-side:

1. **Weight tracking** — log a body weight entry, see history/trend. Backend: `/api/weights` (GET/POST/DELETE).
2. **Macro/calorie logging** — log a meal/food entry with calories and optional protein/carbs/fat. Backend: `/api/meals` (GET/POST/DELETE).
3. **Workout routines** — define a named routine (a list of exercises with target sets/reps), and log actual sets performed against it. Backend: `/api/workouts` + `/api/workout-sets`.
4. **Dashboard / trends** — once there's real data, replace the placeholder `Dashboard.jsx` with actual summaries (recent weight trend, today's macros vs. some target, recent workouts). This is the one piece with no backend counterpart yet — it's just aggregating what the other endpoints already return.

## Open questions to decide before/while building the above

These are real open decisions, not settled defaults — flagging them here so they get made deliberately instead of by accident:

- **Routing.** Nothing beyond Login/Dashboard exists, so there's no router yet. Once there's more than one logged-in screen, we need `react-router-dom` (or similar) — this should happen at the start of building feature #1 above, not be retrofitted later.
- **Client state / data fetching.** Right now `App.jsx` does a single manual `fetch` + `useState`. That won't scale cleanly once multiple screens need to fetch/mutate/cache server data (e.g. adding a weight entry should update a list without a full reload). Worth deciding early whether to reach for something like TanStack Query, or keep it manual as long as possible — no decision has been made either way.
- **Charts.** Trend views (weight over time, macros over time) will need a charting library eventually. Not needed until the dashboard phase.
- **Units.** The backend schema is metric-only right now (`weightKg`). If imperial units matter, that's a backend + frontend decision to make together, not a frontend-only formatting concern — worth resolving before building the weight-tracking screen, since retrofitting a unit system after data exists is more painful than deciding upfront.

## Running locally

This only runs meaningfully against the BFF — see [server/README.md](server/README.md) for the full backend setup (Postgres + Google OAuth credentials). Once that's running on `:4000`:

```bash
npm install
npm run dev      # starts on :5173, proxies /api and /auth to :4000
```

`npm run lint` and `npm run build` both work standalone without the backend running (they don't need a live connection), and are worth running before committing — `eslint.config.js` explicitly excludes `server/` since that's a Node app, not a browser one, and gets its own conventions.
