import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.ts'
import { prisma } from '../db.ts'
import { macroGoalSchema as upsertSchema } from '@gainz/shared/schemas'


export default async function macroGoalRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  // 200 + null when unset, not 404 — matches how every other GET here treats
  // "nothing yet" as a normal empty state (/weights, /meals return []).
  app.get('/macro-goal', async (request) => {
    return prisma.macroGoal.findUnique({ where: { userId: request.userId } })
  })

  app.put('/macro-goal', async (request, reply) => {
    const parsed = upsertSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const goal = await prisma.macroGoal.upsert({
      where: { userId: request.userId },
      create: { ...parsed.data, userId: request.userId },
      update: parsed.data,
    })
    return reply.code(200).send(goal)
  })
}
