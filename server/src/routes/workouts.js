import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../db.js'

const exerciseSchema = z.object({
  name: z.string().min(1),
  targetSets: z.number().int().positive().optional(),
  targetReps: z.number().int().positive().optional(),
  order: z.number().int().nonnegative().optional(),
})

const createRoutineSchema = z.object({
  name: z.string().min(1),
  exercises: z.array(exerciseSchema),
  notes: z.string().optional(),
})

const createSetSchema = z.object({
  routineId: z.string().optional(),
  splitLogId: z.string().optional(),
  exerciseName: z.string().min(1),
  weightKg: z.number().nonnegative().optional(),
  reps: z.number().int().nonnegative().optional(),
  performedAt: z.coerce.date().optional(),
})

const listSetsQuerySchema = z.object({
  splitLogId: z.string().optional(),
})

export default async function workoutRoutes(app) {
  app.addHook('onRequest', requireAuth)

  app.get('/workouts', async (request) => {
    return prisma.workoutRoutine.findMany({
      where: { userId: request.session.userId },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/workouts', async (request, reply) => {
    const parsed = createRoutineSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const routine = await prisma.workoutRoutine.create({
      data: { ...parsed.data, userId: request.session.userId },
    })
    return reply.code(201).send(routine)
  })

  app.delete('/workouts/:id', async (request, reply) => {
    const { count } = await prisma.workoutRoutine.deleteMany({
      where: { id: request.params.id, userId: request.session.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })

  app.get('/workout-sets', async (request, reply) => {
    const parsedQuery = listSetsQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return reply.badRequest(parsedQuery.error.message)
    }

    return prisma.workoutSet.findMany({
      where: {
        userId: request.session.userId,
        ...(parsedQuery.data.splitLogId && { splitLogId: parsedQuery.data.splitLogId }),
      },
      orderBy: { performedAt: 'desc' },
    })
  })

  app.post('/workout-sets', async (request, reply) => {
    const parsed = createSetSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    if (parsed.data.routineId) {
      const routine = await prisma.workoutRoutine.findFirst({
        where: { id: parsed.data.routineId, userId: request.session.userId },
        select: { id: true },
      })
      if (!routine) {
        return reply.badRequest('routineId does not belong to a routine you own')
      }
    }

    if (parsed.data.splitLogId) {
      const log = await prisma.splitLog.findFirst({
        where: { id: parsed.data.splitLogId, userId: request.session.userId },
        select: { id: true },
      })
      if (!log) {
        return reply.badRequest('splitLogId does not belong to a log you own')
      }
    }

    const set = await prisma.workoutSet.create({
      data: { ...parsed.data, userId: request.session.userId },
    })
    return reply.code(201).send(set)
  })

  app.delete('/workout-sets/:id', async (request, reply) => {
    const { count } = await prisma.workoutSet.deleteMany({
      where: { id: request.params.id, userId: request.session.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
