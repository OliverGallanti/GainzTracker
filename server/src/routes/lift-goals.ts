import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.ts'
import { prisma } from '../db.ts'
import { liftGoalsSchema as updateSchema } from '@gainz/shared/schemas'


// Rows -> { [exerciseName]: goalKg }, the shape the client looks goals up by.
// A lift with no goal simply has no key.
const toMap = (rows: { exerciseName: string; goalKg: number }[]) => Object.fromEntries(rows.map((r) => [r.exerciseName, r.goalKg]))

export default async function liftGoalRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  app.get('/lift-goals', async (request) => {
    return toMap(await prisma.liftGoal.findMany({ where: { userId: request.userId } }))
  })

  app.put('/lift-goals', async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const userId = request.userId
    // All-or-nothing: a request that sets four goals never lands two of them.
    await prisma.$transaction(
      Object.entries(parsed.data).map(([exerciseName, goalKg]) =>
        prisma.liftGoal.upsert({
          where: { userId_exerciseName: { userId, exerciseName } },
          create: { userId, exerciseName, goalKg },
          update: { goalKg },
        }),
      ),
    )

    return toMap(await prisma.liftGoal.findMany({ where: { userId } }))
  })
}
