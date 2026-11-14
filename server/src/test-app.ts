import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The route tests' database and app. They run against a real Postgres (the
// rules that matter live in queries and constraints), in a database of their
// own:
// - TEST_DATABASE_URL when set (CI), or
// - locally, server/.env's DATABASE_URL with "_test" added to the database name,
//   only when that database is on this machine.
// Anything not named *_test is refused, so test rows never land in real data.
// Nothing is ever deleted: every test makes its own new users, so rows left
// from earlier runs don't matter.
// With no database at all the route tests are skipped, so `npm test` still runs
// everywhere.

const serverDir = fileURLToPath(new URL('..', import.meta.url))

export function testDatabaseUrl(): string | null {
  let url = process.env.TEST_DATABASE_URL
  if (!url) {
    const devUrl = readEnvFile(`${serverDir}/.env`).DATABASE_URL
    if (!devUrl) return null
    const parsed = new URL(devUrl)
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return null
    parsed.pathname = `${parsed.pathname}_test`
    url = parsed.toString()
  }
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('The test database must be named *_test')
  }
  return url
}

// A minimal KEY=value reader, so the dev .env never lands in process.env (its
// DATABASE_URL is the dev database). No file: no values.
function readEnvFile(path: string): Record<string, string> {
  try {
    const text = readFileSync(path, 'utf8')
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/))
        .filter((m): m is RegExpMatchArray => m != null)
        .map((m) => [m[1], m[2]]),
    )
  } catch {
    return {}
  }
}

// Brings the test database up to the latest migration (creating it if needed;
// it never deletes anything) and builds the app on it.
export async function startTestApp(url: string) {
  Object.assign(process.env, {
    DATABASE_URL: url,
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:4000/auth/google/callback',
    FRONTEND_URL: 'http://localhost:5173',
  })
  execSync('npx prisma migrate deploy', { cwd: serverDir, env: process.env, stdio: 'pipe' })

  // Imported only now: they read the environment when they load.
  const { buildApp } = await import('./app.ts')
  const { prisma } = await import('./db.ts')
  const { issueToken } = await import('./auth/tokens.ts')
  const app = buildApp()
  app.log.level = 'silent'
  await app.ready()

  let n = 0
  // A new user and the Bearer header the phone would send for them.
  const newUser = async () => {
    n += 1
    const user = await prisma.user.create({ data: { googleId: `google-${n}-${Date.now()}`, email: `user${n}-${Date.now()}@test.local` } })
    const { token } = await issueToken(user.id)
    return { id: user.id, auth: { authorization: `Bearer ${token}` } }
  }

  return { app, prisma, newUser }
}
