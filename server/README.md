# Gainz.Tracker server

A Fastify backend-for-frontend (BFF) between the two apps and Postgres. It handles sign-in, holds the sessions and is the only thing that talks to the database. In production it also serves the built web app, so the browser sees one origin. The apps never see a database credential, a Google token or a client secret.

## Endpoints

| Path | Methods | What |
| --- | --- | --- |
| `/auth/google`, `/auth/google/callback` | GET | Web sign-in with Google (OAuth, PKCE) |
| `/auth/google/token` | POST | Phone sign-in: a Google ID token in, a Bearer token out |
| `/auth/token` | DELETE | Revoke the phone's token |
| `/auth/logout` | POST | End the web session |
| `/auth/passkey/registration/*`, `/auth/passkey/authentication/*` | POST | Add a passkey, sign in with one |
| `/api/me` | GET, PUT, DELETE | Profile and meal names; DELETE (body `{ "confirm": "DELETE" }`) erases the account and all its data |
| `/api/macro-goal`, `/api/lift-goals` | GET, PUT | Daily macro targets, Big 4 goals |
| `/api/meals`, `/api/meals/:id` | GET, POST, PATCH, DELETE | Logged foods (`?since=` and `?until=` for a day) |
| `/api/saved-foods`, `/api/saved-foods/:id` | GET, POST, PUT, DELETE | My foods |
| `/api/weights`, `/api/weights/:id` | GET, POST, PATCH, DELETE | Weight and body fat |
| `/api/workout-splits`, `/api/workout-splits/:id` | GET, POST, PATCH, DELETE | Routines (one active) |
| `/api/workout-splits/logs` | GET | Every training day, newest first |
| `/api/workout-splits/:id/logs`, `.../logs/:logId` | GET, POST, PATCH, DELETE | Training days (one per calendar day) |
| `/api/workout-splits/:id/logs/:logId/sets` | PUT | Save a day's sets (replaces them in one transaction) |
| `/api/workout-sets`, `/api/workout-sets/:id` | GET, POST, DELETE | Sets and Big 4 lifts (`?splitLogId=` for one day) |
| `/api/products/search?q=`, `/api/products/:barcode` | GET | Food search on Open Food Facts |
| `/api/passkeys`, `/api/passkeys/:id` | GET, DELETE | Manage passkeys |
| `/healthz` | GET | Health check that doesn't touch the database |

## Sign-in

**Web (Google).** The browser goes to `/auth/google`, and the server does the rest ([routes/auth.ts](src/routes/auth.ts)):

1. It creates a PKCE pair and a `state` value, keeps them for 5 minutes in a signed httpOnly cookie, and redirects to Google.
2. On the callback it checks `state`, then exchanges the code with `openid-client`. That call also verifies the ID token's signature, issuer, audience and expiry; nothing here verifies a JWT by hand.
3. It upserts the `User`, creates a session, and redirects back to the app.

**Sessions** live in Postgres ([auth/prisma-session-store.ts](src/auth/prisma-session-store.ts)), not in a signed cookie, so logging out takes effect immediately. The cookie `gt_session` is `httpOnly`, `sameSite: 'lax'` (`strict` would drop it on the redirect back from Google), and `secure` in production.

**Logout.** `session.destroy()` doesn't clear the cookie on its own, so `/auth/logout` calls `clearCookie` with the same `path` and `domain` the cookie was set with (exported from [auth/session-plugin.ts](src/auth/session-plugin.ts)).

**Phone.** Native Google Sign-In gives an ID token. `POST /auth/google/token` verifies it with `jose` (signature, issuer, audience, expiry and a verified email; see [auth/google-id-token.ts](src/auth/google-id-token.ts)) and returns a Bearer token:

- The token is 32 random bytes, and only its SHA-256 hash is stored.
- It lasts 90 days, with no refresh.
- Revoking always answers 204, so it can't be used to test whether a token is valid.

**Passkeys** ([routes/passkeys.ts](src/routes/passkeys.ts), `@simplewebauthn/server`) are an extra way to sign in to an account made with Google. You can't sign up with a passkey alone.

- **No username:** there's no username field. The browser offers any passkey saved for the site, and the credential id finds the user.
- **The challenge** waits between the two steps in a signed cookie for 5 minutes. Registration and sign-in each use their own cookie.
- **`rpID`** is the hostname of `FRONTEND_URL` (no port), and the expected origin has no trailing slash ([auth/webauthn.ts](src/auth/webauthn.ts)).
- **Two gotchas.** A sign-in returns its counter as `newCounter`; registration calls it `counter`. And both verify calls sometimes throw and sometimes return `verified: false`, so the code needs both a `try/catch` and a check of `verified`.

## Keeping data safe

- **Who you are:** every `/api` route sits behind `requireAuth` ([middleware/require-auth.ts](src/middleware/require-auth.ts)), which takes the user from the session cookie or the Bearer token. If a Bearer token is sent, only the token counts.
- **Only your data:** every query is scoped with `userId` from the session or token, never from the URL or body. Changes and deletes check ownership in the same query (`deleteMany({ where: { id, userId } })`), so "not yours" and "doesn't exist" are the same 404.
- **Validation:** every request body is checked with zod schemas in [shared/src/schemas.ts](../shared/src/schemas.ts), the same file the apps use.
- **Retries never duplicate:** creates accept an optional `id` made by the client. A repeat with your own id returns the existing row (200), and someone else's id gets a 409. That's what makes the phone's offline queue safe.
- **Rate limits** (`@fastify/rate-limit`, in memory): 30 sign-in requests a minute per IP on `/auth/*`, and 30 food lookups a minute per user. Past that the answer is 429.
- **CORS** only allows `FRONTEND_URL`, with credentials.
- **Tests:** [routes/api.test.ts](src/routes/api.test.ts) runs the real app against a real Postgres and checks validation, retries, limits and that no user can read or change another's data.

## Data

PostgreSQL through Prisma ([prisma/schema.prisma](prisma/schema.prisma)), metric only.

- **`User`:** the Google account plus profile fields (`heightCm`, goals, `sex`, `age`, `activityLevel`) and `mealNames`, the user's own meals in order.
- **`WeightEntry`:** weight, plus body fat measured at the same time.
- **`MacroEntry`:** a logged food.
  - It stores its meal by name, so a meal renamed away shows under "Other".
  - It keeps `amount` and `unit` (`g` or `serving`), so an edit can rescale it.
- **`SavedFood`:** My foods, with values per serving or per 100 g (`basis`), plus a serving's weight when known. Names are unique per user, and saving a name again replaces it.
- **`MacroGoal`:** one row per user. **`LiftGoal`:** one row per user and lift, keyed by the lift's name.
- **`WorkoutSplit`:** a routine (`days`, `daysPerWeek`, and `dayColors`, a colour per day name). Only one is active per user; older ones stay, so their days still count toward the streak.
- **`SplitLog`:** a training day.
  - It stores the day the user picked (`dayIndex`) and whether it was done or skipped.
  - Only one is allowed per calendar day; the route returns 409, the database doesn't enforce it.
- **`WorkoutSet`:** a set.
  - With a `splitLogId` it belongs to a training day and is deleted with it. Without one it's a Big 4 lift.
  - `durationSeconds` and `restSeconds` come from the phone's live workout timer.
- **`Session`, `AuthToken`, `Credential`:** web sessions, phone tokens, passkeys.
- **Not used any more:**
  - `WorkoutRoutine` and `WorkoutSet.routineId`;
  - the four `User.{lift}GoalKg` columns, replaced by `LiftGoal`. That migration's file ends with SQL to roll it back.

  Dropping them is a separate migration, still to do.

**Food data** comes from [Open Food Facts](https://world.openfoodfacts.org) (free, no key, ODbL: keep the attribution in the apps), fetched by the server so the apps don't depend on it ([lib/open-food-facts.ts](src/lib/open-food-facts.ts)).

- **Barcode:** an unknown barcode is `null` with a 200, and the route gives 502 only when Open Food Facts is down.
- **Name search:** it uses search.openfoodfacts.org and returns up to 10 results that have calories.
- **Missing values:** calories fall back to kJ ÷ 4.184. A missing macro stays `null`, not 0.
- **No cache:** nothing is stored.

## How it's wired

- **Registration:** [app.ts](src/app.ts) registers everything by hand, plugins first (`sensible`, `cookie`, `cors`, `session`, rate limit), then the routes. With this few files that's easier to follow than auto-loading. Plugins whose decorators the routes need are wrapped with `fastify-plugin`.
- **Config:** [config.ts](src/config.ts) checks every environment variable with zod at startup and stops with a clear message if one is missing.
- **TypeScript without a build:** Node runs the `.ts` files directly, so imports keep their `.ts` extension.
- **Production:** it serves `web/dist`.
  - `/assets/*` files are named after their content, so they're cached for a year.
  - `index.html` is checked again on every visit.
  - An unknown path that isn't `/api`, `/auth` or a file gets the app.
- **Dev:** Vite forwards `/api` and `/auth` here, so the browser only ever talks to `localhost:5173`.

## Migrations

- `prisma migrate dev` creates a migration. It needs a database user with `CREATEDB`, for Prisma's shadow database.
- A deploy runs `prisma migrate deploy`.
- **Never edit a migration after it has been applied**, not even a comment. Prisma checksums the file and will ask to reset the database.

## Running locally

1. Have Postgres running: `docker compose up -d` at the repo root, a local install, or Neon.
2. Copy `.env.example` to `.env` and fill it in:
   - `DATABASE_URL`: your Postgres connection string.
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: a **Web application** OAuth client in Google Cloud Console, with `http://localhost:4000/auth/google/callback` as a redirect URI.
   - `SESSION_SECRET`: 32 or more random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `FRONTEND_URL`: `http://localhost:5173`.
3. `npm install` at the repo root, then `npx prisma migrate dev` here.
4. `npm run dev:server` at the root starts the server on port 4000 and restarts it on changes.

## Not here, on purpose

- **No refresh tokens:** Google is only used to know who you are, never to call Google APIs.
- **One sign-in provider:** `User.googleId` is Google-specific. A second provider would mean an `Account` table.
- **No passkey-only sign-up**, and no renaming passkeys.
