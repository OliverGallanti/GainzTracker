import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import cookiePlugin from './plugins/cookie.js'
import corsPlugin from './plugins/cors.js'
import sessionPlugin from './auth/session-plugin.js'
import authRoutes from './routes/auth.js'
import meRoutes from './routes/me.js'
import weightRoutes from './routes/weights.js'
import mealRoutes from './routes/meals.js'
import workoutRoutes from './routes/workouts.js'

export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(sensible)
  app.register(cookiePlugin)
  app.register(corsPlugin)
  app.register(sessionPlugin)

  app.register(authRoutes, { prefix: '/auth' })
  app.register(meRoutes, { prefix: '/api' })
  app.register(weightRoutes, { prefix: '/api' })
  app.register(mealRoutes, { prefix: '/api' })
  app.register(workoutRoutes, { prefix: '/api' })

  return app
}
