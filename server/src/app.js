import Fastify from 'fastify'
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

  return app
}
