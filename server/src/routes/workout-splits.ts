import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.ts'
import { repliedWithExisting } from '../lib/client-id.ts'
import { prisma } from '../db.ts'
import { createLogSchema, createSplitSchema, updateLogSchema, updateSplitSchema } from '@gainz/shared/schemas'


export default async function workoutSplitRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  app.get('/workout-splits', async (request) => {
    return prisma.workoutSplit.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/workout-splits', async (request, reply) => {
    const parsed = createSplitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    if (parsed.data.id) {
      const existing = await prisma.workoutSplit.findUnique({ where: { id: parsed.data.id } })
      if (repliedWithExisting(reply, request.userId, existing)) return reply
    }

    const [, split] = await prisma.$transaction([
      prisma.workoutSplit.updateMany({
        where: { userId: request.userId, active: true },
        data: { active: false },
      }),
      prisma.workoutSplit.create({
        data: { ...parsed.data, userId: request.userId, active: true },
      }),
    ])
    return reply.code(201).send(split)
  })

  app.patch<{ Params: { id: string } }>('/workout-splits/:id', async (request, reply) => {
    const parsed = updateSplitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const { count } = await prisma.workoutSplit.updateMany({
      where: { id: request.params.id, userId: request.userId },
      data: parsed.data,
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })

  app.delete<{ Params: { id: string } }>('/workout-splits/:id', async (request, reply) => {
    const { count } = await prisma.workoutSplit.deleteMany({
      where: { id: request.params.id, userId: request.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })

  app.get<{ Params: { id: string } }>('/workout-splits/:id/logs', async (request, reply) => {
    const split = await prisma.workoutSplit.findFirst({
      where: { id: request.params.id, userId: request.userId },
      select: { id: true },
    })
    if (!split) {
      return reply.notFound()
    }

    return prisma.splitLog.findMany({
      where: { splitId: request.params.id, userId: request.userId },
      orderBy: { loggedAt: 'desc' },
    })
  })

  app.post<{ Params: { id: string } }>('/workout-splits/:id/logs', async (request, reply) => {
    const parsed = createLogSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const split = await prisma.workoutSplit.findFirst({
      where: { id: request.params.id, userId: request.userId },
    })
    if (!split) {
      return reply.notFound()
    }

    const { id, completed, dayIndex, dayStart, dayEnd, loggedAt } = parsed.data
    if (id) {
      const existing = await prisma.splitLog.findUnique({ where: { id } })
      if (repliedWithExisting(reply, request.userId, existing)) return reply
    }

    if (dayIndex >= split.days.length) {
      return reply.badRequest('dayIndex is not a day of this split')
    }
    if (loggedAt < dayStart || loggedAt >= dayEnd) {
      return reply.badRequest('loggedAt must fall within the day being logged')
    }

    const alreadyLogged = await prisma.splitLog.count({
      where: { splitId: split.id, loggedAt: { gte: dayStart, lt: dayEnd } },
    })
    if (alreadyLogged > 0) {
      return reply.conflict('Already logged a session for that day')
    }

    const log = await prisma.splitLog.create({
      data: {
        id,
        userId: request.userId,
        splitId: split.id,
        dayIndex,
        completed,
        loggedAt,
      },
    })
    return reply.code(201).send(log)
  })

  app.patch<{ Params: { id: string; logId: string } }>('/workout-splits/:id/logs/:logId', async (request, reply) => {
    const parsed = updateLogSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    if (parsed.data.dayIndex !== undefined) {
      const split = await prisma.workoutSplit.findFirst({
        where: { id: request.params.id, userId: request.userId },
        select: { days: true },
      })
      if (!split) {
        return reply.notFound()
      }
      if (parsed.data.dayIndex >= split.days.length) {
        return reply.badRequest('dayIndex is not a day of this split')
      }
    }

    const { count } = await prisma.splitLog.updateMany({
      where: {
        id: request.params.logId,
        splitId: request.params.id,
        userId: request.userId,
      },
      data: parsed.data,
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })

  app.delete<{ Params: { id: string; logId: string } }>('/workout-splits/:id/logs/:logId', async (request, reply) => {
    const { count } = await prisma.splitLog.deleteMany({
      where: {
        id: request.params.logId,
        splitId: request.params.id,
        userId: request.userId,
      },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
