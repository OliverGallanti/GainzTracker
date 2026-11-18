# Development

## Repo

- npm workspaces, one install and one lockfile at the root.
  - `web/` is the web app.
  - `mobile/` is the Android app.
  - `server/` is the API.
  - `shared/` (`@gainz/shared`) holds the logic and types both apps use.
- `shared/` is TypeScript source, imported as `@gainz/shared/<file>`. Nothing in it may touch the DOM, `fetch` or React, so both apps can use it.
- Run checks from the root: `npm run lint`, `npm run typecheck`, `npm test` (or `npm run test:watch`).
- React is pinned to one exact version for the whole repo (root `overrides`). Two copies of React crash a React Native app.

## TypeScript

- `npm run typecheck` runs `tsc` without output: it's a check, not a build.
- **Web:** Vite and Vitest compile TypeScript themselves. Tests are checked loosely, because they pass partial inputs on purpose.
- **Server:** Node runs the `.ts` files directly (type stripping), so there's no build step. That's why imports keep their `.ts` extension and only erasable syntax is allowed (no `enum`). It needs Node 22.18 or later; Render runs 24.
- TypeScript is pinned to 6.0 until `typescript-eslint` supports 7.

## Tests

- **Logic:** `shared/src/` and `web/src/lib/`, with Vitest.
- **Server routes:** `server/src/routes/api.test.ts` runs the real app against a real Postgres. It checks validation, retries and that no user can read or change another's data.
  - It uses `TEST_DATABASE_URL`, or else the local database in `server/.env` with `_test` added to the name.
  - It refuses any database not named `*_test`, and is skipped when there's no database.
  - It never wipes anything: each test makes its own users.
- **CI:** `.github/workflows/checks.yml` runs lint, typecheck, tests (on a throwaway Postgres) and the web build on every push.

## Deploying (Render + Neon)

One Render web service runs the API and serves the built web app (when `NODE_ENV=production`), so the browser sees one origin: no CORS, and first-party cookies. [`render.yaml`](../render.yaml) describes it.

1. **Neon:** create a project and copy the connection string that is *not* pooled (no `-pooler` in the host). Add `&connect_timeout=15`, because a sleeping Neon database takes a moment to wake.
2. **Render:** New → Blueprint → this repo. Fill in the variables marked `sync: false`. `SESSION_SECRET` is generated for you.
3. **Google Cloud:** add `https://<service>.onrender.com/auth/google/callback` as a redirect URI, and set the same value as `GOOGLE_REDIRECT_URI` on Render.
4. **Auto-Deploy:** set it to "After CI checks pass", so a failing push never goes live.
5. **Deploy:** the build runs `prisma migrate deploy`, so a failing migration stops the deploy, not the running app.

Good to know:
- A free Render service sleeps after 15 minutes without traffic and takes about a minute to wake. `GET /healthz` doesn't touch the database.
- Passkeys are tied to the domain they were registered on.
- Changing `SESSION_SECRET` signs everyone out.

## Releasing

Web, server and Android are released together under one version (semver: a patch for fixes, a minor for features). The version is in the root `package.json` and in `shared/src/about.ts`, and a test fails if they differ.

1. Bump both (`npm version minor --no-git-tag-version`, then edit `about.ts`), commit, push, and wait for Render to show the deploy as Live.
2. Publish the phone update: `npm run update -w mobile -- "v1.2.0: what changed"`.
3. Tag and release: `git tag v1.2.0 && git push origin v1.2.0`, then `gh release create v1.2.0 --generate-notes`.

The APK's own version (`app.json` `version`; EAS counts `versionCode` itself) only changes when a new APK is built.
