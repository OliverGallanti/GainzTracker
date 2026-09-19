import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import sensible from '@fastify/sensible'
import { isProduction } from './config.js'
import cookiePlugin from './plugins/cookie.js'
import corsPlugin from './plugins/cors.js'
import sessionPlugin from './auth/session-plugin.js'
import authRoutes from './routes/auth.js'
import meRoutes from './routes/me.js'
import weightRoutes from './routes/weights.js'
import mealRoutes from './routes/meals.js'
import workoutRoutes from './routes/workouts.js'
import passkeyRoutes from './routes/passkeys.js'
import passkeyCredentialRoutes from './routes/passkey-credentials.js'
import macroGoalRoutes from './routes/macro-goal.js'
import workoutSplitRoutes from './routes/workout-splits.js'
import liftGoalRoutes from './routes/lift-goals.js'
import savedFoodRoutes from './routes/saved-foods.js'
import productRoutes from './routes/products.js'

export function buildApp() {
  // Behind a TLS-terminating proxy, request.protocol reads as http unless the
  // forwarded headers are trusted — and @fastify/session silently skips saving
  // any secure cookie it considers to be on an insecure connection.
  const app = Fastify({ logger: true, trustProxy: isProduction })

  app.register(sensible)
  app.register(cookiePlugin)
  app.register(corsPlugin)
  app.register(sessionPlugin)

  app.register(authRoutes, { prefix: '/auth' })
  app.register(passkeyRoutes, { prefix: '/auth/passkey' })
  app.register(meRoutes, { prefix: '/api' })
  app.register(weightRoutes, { prefix: '/api' })
  app.register(mealRoutes, { prefix: '/api' })
  app.register(workoutRoutes, { prefix: '/api' })
  app.register(passkeyCredentialRoutes, { prefix: '/api' })
  app.register(macroGoalRoutes, { prefix: '/api' })
  app.register(workoutSplitRoutes, { prefix: '/api' })
  app.register(liftGoalRoutes, { prefix: '/api' })
  app.register(savedFoodRoutes, { prefix: '/api' })
  app.register(productRoutes, { prefix: '/api' })

  // For uptime checks / keep-alive pings. Deliberately doesn't touch the
  // database, so a ping never wakes a scale-to-zero Postgres.
  app.get('/healthz', async () => ({ ok: true }))

  // In production this one process serves the built client too, so the browser
  // sees a single origin: no CORS, first-party cookies, and the passkey origin
  // is simply the site itself. In dev, Vite serves the client and proxies here.
  if (isProduction) {
    app.register(fastifyStatic, { root: fileURLToPath(new URL('../../dist', import.meta.url)) })
    // Client-side routes get the app shell. A path that looks like a file (has an
    // extension) or belongs to /api or /auth is a real 404 — in particular a stale
    // hashed asset after a deploy must not come back as HTML pretending to be JS.
    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split('?')[0]
      const isApiCall = path.startsWith('/api/') || path.startsWith('/auth/')
      const looksLikeFile = /\.[a-z0-9]+$/i.test(path)
      if (request.method !== 'GET' || isApiCall || looksLikeFile) return reply.notFound()
      return reply.sendFile('index.html')
    })
  }

  return app
}
