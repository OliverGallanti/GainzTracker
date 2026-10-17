import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.ts'
import { prisma } from '../db.ts'

// Must match BIG_FOUR_LIFTS in src/lib/lifts.js on the client (a client test
// pins that list). The names are the same display names WorkoutSet.exerciseName
// uses. Restricting to a known set keeps the table from collecting arbitrary
// user-supplied keys; adding a lift is a one-line change here and on the
// client, with no schema change.
const LIFTS = ['Deadlift', 'Squat', 'Bench Press', 'Overhead Press']

// { "Deadlift": 200, "Squat": 150 } — only the lifts being changed. An explicit
// refine rather than an enum-keyed z.record, which means "every key required"
// in zod 4 but "any subset" in zod 3.
const updateSchema = z
  .record(z.string(), z.number().positive())
  .refine((goals) => Object.keys(goals).length > 0, { message: 'No goals to update' })
  .refine((goals) => Object.keys(goals).every((name) => LIFTS.includes(name)), {
    message: 'Unknown lift',
  })

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
