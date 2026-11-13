import type { FastifyInstance } from 'fastify'
import { updateMeSchema as updateSchema } from '@gainz/shared/schemas'
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
}
