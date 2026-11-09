import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.ts'
import { clientId, repliedWithExisting } from '../lib/client-id.ts'
import { prisma } from '../db.ts'

const exerciseSchema = z.object({
  name: z.string().min(1),
  targetSets: z.number().int().positive().optional(),
  targetReps: z.number().int().positive().optional(),
  order: z.number().int().nonnegative().optional(),
})

const createRoutineSchema = z.object({
  id: clientId,
  name: z.string().min(1),
  exercises: z.array(exerciseSchema),
  notes: z.string().optional(),
})

const createSetSchema = z.object({
  id: clientId,
  routineId: z.string().optional(),
  splitLogId: z.string().optional(),
  exerciseName: z.string().min(1),
  weightKg: z.number().nonnegative().optional(),
  reps: z.number().int().nonnegative().optional(),
  rpe: z.number().min(6).max(10).multipleOf(0.5).optional(), // RPE_VALUES in shared/src/lifts.ts
  performedAt: z.coerce.date().optional(),
})

const listSetsQuerySchema = z.object({
  splitLogId: z.string().optional(),
})

export default async function workoutRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  app.get('/workouts', async (request) => {
    return prisma.workoutRoutine.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/workouts', async (request, reply) => {
    const parsed = createRoutineSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    if (parsed.data.id) {
      const existing = await prisma.workoutRoutine.findUnique({ where: { id: parsed.data.id } })
      if (repliedWithExisting(reply, request.userId, existing)) return reply
    }

    const routine = await prisma.workoutRoutine.create({
      data: { ...parsed.data, userId: request.userId },
    })
    return reply.code(201).send(routine)
  })

  app.delete<{ Params: { id: string } }>('/workouts/:id', async (request, reply) => {
    const { count } = await prisma.workoutRoutine.deleteMany({
      where: { id: request.params.id, userId: request.userId },
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
        userId: request.userId,
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

    if (parsed.data.id) {
      const existing = await prisma.workoutSet.findUnique({ where: { id: parsed.data.id } })
      if (repliedWithExisting(reply, request.userId, existing)) return reply
    }

    if (parsed.data.routineId) {
      const routine = await prisma.workoutRoutine.findFirst({
        where: { id: parsed.data.routineId, userId: request.userId },
        select: { id: true },
      })
      if (!routine) {
        return reply.badRequest('routineId does not belong to a routine you own')
      }
    }

    if (parsed.data.splitLogId) {
      const log = await prisma.splitLog.findFirst({
        where: { id: parsed.data.splitLogId, userId: request.userId },
        select: { id: true },
      })
      if (!log) {
        return reply.badRequest('splitLogId does not belong to a log you own')
      }
    }

    const set = await prisma.workoutSet.create({
      data: { ...parsed.data, userId: request.userId },
    })
    return reply.code(201).send(set)
  })

  app.delete<{ Params: { id: string } }>('/workout-sets/:id', async (request, reply) => {
    const { count } = await prisma.workoutSet.deleteMany({
      where: { id: request.params.id, userId: request.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
