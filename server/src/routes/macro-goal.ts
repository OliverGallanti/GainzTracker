import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.ts'
import { prisma } from '../db.ts'

const upsertSchema = z.object({
  proteinG: z.number().positive(),
  fatG: z.number().positive(),
  carbsG: z.number().positive(),
  calorieTarget: z.number().int().positive().optional(),
})

export default async function macroGoalRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  // 200 + null when unset, not 404 — matches how every other GET here treats
  // "nothing yet" as a normal empty state (/weights, /meals return []).
  app.get('/macro-goal', async (request) => {
    return prisma.macroGoal.findUnique({ where: { userId: request.session.userId } })
  })

  app.put('/macro-goal', async (request, reply) => {
    const parsed = upsertSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const goal = await prisma.macroGoal.upsert({
      where: { userId: request.session.userId },
      create: { ...parsed.data, userId: request.session.userId },
      update: parsed.data,
    })
    return reply.code(200).send(goal)
  })
}
