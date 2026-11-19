import type { FastifyInstance } from 'fastify'
import { deleteAccountSchema, updateMeSchema as updateSchema } from '@gainz/shared/schemas'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../auth/session-plugin.ts'
import { requireAuth } from '../middleware/require-auth.ts'
import { prisma } from '../db.ts'

const userSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  heightCm: true,
  weightGoalKg: true,
  bodyFatGoalPercent: true,
  sex: true,
  age: true,
  activityLevel: true,
  mealNames: true,
}

export default async function meRoutes(app: FastifyInstance) {
  app.get('/me', { onRequest: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: userSelect,
    })

    if (!user) {
      return reply.code(401).send({ error: 'Not authenticated' })
    }

    return user
  })

  app.put('/me', { onRequest: requireAuth }, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: parsed.data,
      select: userSelect,
    })
    return user
  })

  // Erases the account at once: every table holding a user's data cascades from
  // User (schema.prisma), web sessions and phone tokens included.
  app.delete('/me', { onRequest: requireAuth }, async (request, reply) => {
    const parsed = deleteAccountSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest('Send { "confirm": "DELETE" } to delete the account')
    }

    await prisma.user.delete({ where: { id: request.userId } })
    if (request.session.userId) {
      // As /auth/logout: destroy() doesn't clear the browser's cookie itself.
      await request.session.destroy()
      reply.clearCookie(SESSION_COOKIE_NAME, { path: sessionCookieOptions.path, domain: sessionCookieOptions.domain })
    }
    return reply.code(204).send()
  })
}
