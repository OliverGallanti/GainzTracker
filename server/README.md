# Gainz.Tracker BFF

This is the backend for Gainz.Tracker: a Fastify service that sits between the React SPA and Postgres. It owns the Google sign-in flow, holds the session, and is the only thing that ever talks to the database. The frontend never sees a database credential, a Google token, or a client secret — it only ever calls `/api/*` and `/auth/*` on this server.

## Why a custom BFF instead of a managed platform

A managed auth+DB platform (Supabase, Clerk+Neon, etc.) would have gotten a working login with far less code. We didn't go that way because this project is explicitly also a learning exercise in owning that layer, and a custom BFF keeps every credential and every authorization decision in code we control, with no vendor-specific auth model to learn on top of Postgres. The tradeoff is real: we're on the hook for the OAuth flow, session storage, and cookie handling ourselves — more code, but nothing hidden behind a platform.

## How the login flow actually works

The frontend never does any OAuth logic itself — it just navigates the browser to `/auth/google`. Everything else happens server-side:

1. **`GET /auth/google`** ([routes/auth.js](src/routes/auth.js)) generates a PKCE `code_verifier`/`code_challenge` pair and a `state` nonce, stashes both in a short-lived (5 min), signed, httpOnly `oauth_state` cookie, and redirects to Google's consent screen.
2. Google redirects back to **`GET /auth/google/callback`** with a `code` and the `state`. The handler reads the `oauth_state` cookie, verifies the `state` matches (CSRF protection for the OAuth flow), and exchanges the code for tokens via `openid-client`. That exchange call also verifies the returned `id_token`'s signature, issuer, audience, and expiry internally — there's no hand-rolled JWT verification anywhere in this codebase.
3. The verified claims (`sub`, `email`, `name`, `picture`) are used to `upsert` a `User` row — first login creates the account, every login after that just refreshes the profile fields.
4. `request.session.set('userId', user.id)` creates a session, which `@fastify/session` persists via our Prisma-backed store and returns as a signed, opaque session-ID cookie.
5. The browser is redirected back to the SPA. From there, the SPA calls `GET /api/me` to find out who's logged in.

**Why `openid-client` (panva)**: it's the spec-compliant, actively maintained standard for Node OIDC clients. It handles discovery, PKCE, and token/id_token verification correctly so none of that security-sensitive logic had to be written by hand. It's also provider-agnostic, so adding a second SSO provider later doesn't mean switching libraries.

## Passkeys (WebAuthn) — the second login method

Passkeys are an *additional* credential on an account that already exists via Google, not an independent signup path. A logged-in user adds one from the Dashboard; afterward they can log in with it directly, without Google. This was a deliberate scoping choice: a passkey-only signup flow would need profile/email collection UI (WebAuthn gives you no email at all) plus duplicate-account reconciliation — a second system, not a small addition — while scoping it as "one more credential on an existing account" needed zero changes to `User`'s required, unique `googleId`/`email` fields.

Both ceremonies (`server/src/routes/passkeys.js`, using `@simplewebauthn/server`) are a two-step **options → browser ceremony → verify** dance, reusing the exact `oauth_state` cookie pattern from the Google flow — a short-lived (5 min), signed, httpOnly cookie holds the challenge between the two legs. There are two separate cookie names (`passkey_reg_challenge`, `passkey_auth_challenge`, defined in [auth/webauthn.js](src/auth/webauthn.js)) so a stale registration challenge can never be consumed by a login verify call or vice versa.

**Usernameless login**: there's no username field on the Login page. Registration asks for a *discoverable* credential (`authenticatorSelection: { residentKey: 'required' }`), and the login ceremony's `generateAuthenticationOptions` call omits `allowCredentials` entirely — the browser lets the user pick from any passkey registered for this origin, and the response's credential `id` is looked up directly in the `Credential` table to find the owning user. This is safe because a credential ID is a public identifier, not a secret — all real security comes from `verifyAuthenticationResponse` cryptographically checking the signature against the stored public key, which requires the private key that never leaves the user's device.

**rpID vs. this server's own origin**: the ceremony always runs in the browser context of `FRONTEND_URL` (the page the user is actually looking at, `localhost:5173` in dev) — never this server's own origin, even though the browser's requests get proxied here. So `rpID` is derived as the *hostname only* (no port) of `FRONTEND_URL`, and `expectedOrigin` is normalized to strip a trailing slash, since that one is an exact-string comparison rather than a domain match. Get either wrong and every ceremony fails with a confusing, generic error — see [auth/webauthn.js](src/auth/webauthn.js) for both derivations in one place.

**Two library gotchas worth knowing if you touch this code**: (1) `verifyAuthenticationResponse` returns the updated counter as `authenticationInfo.newCounter` — *not* `.counter`, which is what the *registration* side calls it, an easy copy-paste mistake between the two verify calls. (2) Both verify functions are hybrid — they throw on some failures (malformed input, challenge mismatch) and return `{ verified: false }` on others (bad signature) — so the route code needs both a `try/catch` *and* a `.verified` check, the same class of bug already fixed once for the OAuth state cookie's `JSON.parse`.

The `Credential.counter` field detects cloned authenticators (an authenticator's signature counter must always increase); for platform passkeys synced via iCloud/Google Password Manager it's commonly always `0`, which is a known, accepted limitation of the WebAuthn ecosystem, not a bug in this code. `GET /api/passkeys` / `DELETE /api/passkeys/:id` ([routes/passkey-credentials.js](src/routes/passkey-credentials.js)) are plain authenticated CRUD, following the exact same atomic ownership-scoped-delete pattern as `weights.js`.

No CSRF protection was added to the public `authentication/*` endpoints beyond what already exists — the `sameSite: 'lax'` challenge cookie won't ride along on a forged cross-site request, and a WebAuthn assertion is cryptographically bound to the origin by the browser/authenticator itself, so there's nothing to forge without the private key.

## Why sessions live in Postgres, not Redis or a signed cookie

Two realistic options existed: a stateless encrypted cookie (`@fastify/secure-session`) that holds the session data directly, or an opaque cookie pointing at server-side state. We chose the latter, backed by Postgres via a small custom store ([auth/prisma-session-store.js](src/auth/prisma-session-store.js)), for one concrete reason: **revocability**. A stateless cookie can't be invalidated from the server — the only way to "log someone out" is to wait for it to expire or maintain a separate blocklist, which is its own piece of state anyway. A DB-backed session can be deleted on logout and takes effect immediately, which is what actually happens in `POST /auth/logout`.

We put sessions in Postgres instead of Redis because Postgres is already a hard requirement for the app's own data (weights, meals, workouts) — adding Redis just for sessions would be a second piece of infrastructure to run and back up for a solo project, for a workload (session lookups) Postgres handles fine at this scale.

## Cookie behavior, and a bug that's worth knowing about

The session cookie (`gt_session`) is `httpOnly`, `sameSite: 'lax'`, and `secure` in production only (it has to be usable over plain `http://localhost` in dev). `sameSite: 'lax'` specifically — not `'strict'` — because the redirect back from Google's consent screen is a top-level cross-site navigation, and `'strict'` would drop the cookie on that hop and break the login.

One thing we hit and fixed: `@fastify/session`'s `session.destroy()` nulls out `request.session`, which means its own `onSend` hook has nothing left to act on and **does not clear the cookie on the client** — the session is gone from the database, but the browser would keep sending a now-dead cookie for up to 7 days. `POST /auth/logout` ([routes/auth.js](src/routes/auth.js)) works around this by calling `reply.clearCookie()` explicitly, reusing the exact `path`/`domain` the cookie was set with — a `clearCookie` call with mismatched attributes is silently ignored by browsers, which is why those values are exported as constants from [auth/session-plugin.js](src/auth/session-plugin.js) instead of being retyped in both places.

Also worth knowing: every request to `/auth/logout` (or any route) must **not** carry `Content-Type: application/json` unless it actually has a JSON body — Fastify's default body parser rejects an empty body sent with that header. The frontend's `api()` helper only sets that header when a body is present.

## Authorization model

Every route under `/api/*` sits behind the `requireAuth` hook ([middleware/require-auth.js](src/middleware/require-auth.js)), which checks `request.session.userId` and returns 401 if it's missing. Beyond that gate, every single Prisma query in every route handler is scoped with `where: { userId: request.session.userId, ... }`. The `userId` is **read only from the session, never from the request body or URL params** — a client cannot pass someone else's ID and access their data, because nothing in a route handler trusts client-supplied identity.

For single-record mutations (e.g. `DELETE /api/weights/:id`), the ownership check and the mutation are the same atomic query — `deleteMany({ where: { id, userId } })` — rather than "fetch the record, check who owns it, then delete." This means "doesn't exist" and "isn't yours" produce the same result (a 404), which avoids leaking whether a given ID belongs to someone else, and avoids a race between the check and the mutation.

## Why Fastify, and how the app is wired together

Fastify was chosen over Express mainly for its built-in schema/plugin lifecycle and because the ecosystem plugins we rely on (`@fastify/session`, `@fastify/cookie`, `@fastify/cors`) are first-party and well maintained.

[app.js](src/app.js) builds the Fastify instance and registers everything explicitly — plugins first (`sensible` → `cookie` → `cors` → `session`), then routes (`auth` at `/auth`, everything else at `/api`). We register route files directly rather than using `@fastify/autoload`: with a handful of files, explicit registration is easier to trace top-to-bottom than filesystem-based auto-discovery, and this is a small enough app that the convenience isn't worth the indirection.

Plugins that need to attach decorators visible to sibling routes (`request.session`, cookie signing, etc.) are wrapped with `fastify-plugin` ([plugins/cookie.js](src/plugins/cookie.js), [plugins/cors.js](src/plugins/cors.js), [auth/session-plugin.js](src/auth/session-plugin.js)) — without it, Fastify's encapsulation would scope those decorators to the plugin's own context instead of the whole app.

[config.js](src/config.js) validates all required env vars with Zod at startup and throws immediately with a clear message if anything is missing, rather than booting into a half-configured state that fails mysteriously on the first request that needs the missing value.

## Dev proxy and CORS

In development, Vite proxies `/api` and `/auth` to this server (see the root `vite.config.js`), so the browser only ever talks to `localhost:5173` and the session cookie is same-origin from its point of view — no CORS is actually exercised in the normal dev flow. `@fastify/cors` is still registered, locked to `FRONTEND_URL` with `credentials: true`, as defense-in-depth for anything that talks to the BFF directly (curl, Postman, a future mobile client).

In production, the intended shape is for this server to serve the built SPA itself (e.g. via `@fastify/static`) so the whole app is one process on one origin — that's not built yet (see Deferred below).

## Database

PostgreSQL via Prisma ([prisma/schema.prisma](prisma/schema.prisma)). Models: `User`, `Session` (backs the session store described above), `Credential` (registered passkeys, see above), `WeightEntry`, `MacroEntry`, `WorkoutRoutine`, `WorkoutSet`. `WorkoutRoutine.exercises` is a JSON column for now rather than a normalized child table — fine for "define a routine, show it back," but it would need to become a real table if per-exercise editing/querying UI shows up later.

## Running locally

1. Have a Postgres instance reachable (local install, Docker via the repo-root `docker-compose.yml`, or a hosted free tier like Neon).
2. Copy `.env.example` to `.env` and fill it in:
   - `DATABASE_URL` — your Postgres connection string
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from a **Web application** OAuth client in Google Cloud Console, with `http://localhost:4000/auth/google/callback` registered under Authorized redirect URIs
   - `SESSION_SECRET` — any random string 32+ characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `FRONTEND_URL` — `http://localhost:5173` in dev
3. `npm install`
4. `npx prisma migrate dev` — applies migrations and generates the Prisma client. (Note: this requires the DB user to have `CREATEDB` — Prisma uses a disposable shadow database to detect drift during `migrate dev`.)
5. `npm run dev` — starts the server on `PORT` (default `4000`) with `node --watch`.

## What's intentionally not here yet

- No refresh-token handling — only the Google `id_token` is used for identity; we never request ongoing access to Google APIs, so there's nothing to refresh.
- No second SSO provider. `User.googleId` is provider-specific; adding another provider later means introducing a separate `Account`/`Identity` table rather than reworking `User`.
- No passkey-only signup — see the Passkeys section above for why.
- No passkey renaming/relabeling beyond an optional `deviceLabel` set at creation.
- No production deployment config (no prod Dockerfile, no static-file serving wired up, no CI).
- No automated tests — everything so far has been verified by hand against a real Postgres instance, a real Google OAuth app, and (for passkeys) Chrome's WebAuthn virtual authenticator via CDP.
- No rate limiting anywhere, including on the passkey endpoints — deliberately consistent with the rest of the app rather than singled out; if added, it should be a uniform pass across all public auth endpoints, not passkey-specific.
