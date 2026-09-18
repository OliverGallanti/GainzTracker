import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../db.js'

const createSplitSchema = z.object({
  name: z.string().min(1),
  days: z.array(z.string().min(1)).min(1),
})

const createLogSchema = z.object({
  completed: z.boolean(),
  dayStart: z.coerce.date(),
  dayEnd: z.coerce.date(),
})

const updateLogSchema = z
  .object({
    durationMinutes: z.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' })

export default async function workoutSplitRoutes(app) {
  app.addHook('onRequest', requireAuth)

  app.get('/workout-splits', async (request) => {
    return prisma.workoutSplit.findMany({
      where: { userId: request.session.userId },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/workout-splits', async (request, reply) => {
    const parsed = createSplitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const [, split] = await prisma.$transaction([
      prisma.workoutSplit.updateMany({
        where: { userId: request.session.userId, active: true },
        data: { active: false },
      }),
      prisma.workoutSplit.create({
        data: { ...parsed.data, userId: request.session.userId, active: true },
      }),
    ])
    return reply.code(201).send(split)
  })

  app.delete('/workout-splits/:id', async (request, reply) => {
    const { count } = await prisma.workoutSplit.deleteMany({
      where: { id: request.params.id, userId: request.session.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })

  app.get('/workout-splits/:id/logs', async (request, reply) => {
    const split = await prisma.workoutSplit.findFirst({
      where: { id: request.params.id, userId: request.session.userId },
      select: { id: true },
    })
    if (!split) {
      return reply.notFound()
    }

    return prisma.splitLog.findMany({
      where: { splitId: request.params.id, userId: request.session.userId },
      orderBy: { loggedAt: 'desc' },
    })
  })

  app.post('/workout-splits/:id/logs', async (request, reply) => {
    const parsed = createLogSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const split = await prisma.workoutSplit.findFirst({
      where: { id: request.params.id, userId: request.session.userId },
    })
    if (!split) {
      return reply.notFound()
    }

    const { completed, dayStart, dayEnd } = parsed.data

    const alreadyLoggedToday = await prisma.splitLog.count({
      where: { splitId: split.id, loggedAt: { gte: dayStart, lt: dayEnd } },
    })
    if (alreadyLoggedToday > 0) {
      return reply.conflict('Already logged a session for today')
    }

    const existingLogCount = await prisma.splitLog.count({
      where: { splitId: split.id },
    })
    const dayIndex = existingLogCount % split.days.length

    const log = await prisma.splitLog.create({
      data: {
        userId: request.session.userId,
        splitId: split.id,
        dayIndex,
        completed,
      },
    })
    return reply.code(201).send(log)
  })

  app.patch('/workout-splits/:id/logs/:logId', async (request, reply) => {
    const parsed = updateLogSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const { count } = await prisma.splitLog.updateMany({
      where: {
        id: request.params.logId,
        splitId: request.params.id,
        userId: request.session.userId,
      },
      data: parsed.data,
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })

  app.delete('/workout-splits/:id/logs/:logId', async (request, reply) => {
    const { count } = await prisma.splitLog.deleteMany({
      where: {
        id: request.params.logId,
        splitId: request.params.id,
        userId: request.session.userId,
      },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
