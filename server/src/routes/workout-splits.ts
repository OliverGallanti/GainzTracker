import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.ts'
import { repliedWithExisting } from '../lib/client-id.ts'
import { prisma } from '../db.ts'
import { createLogSchema, createSplitSchema, editSplitSchema, replaceSetsSchema, updateLogSchema, updateSplitSchema } from '@gainz/shared/schemas'

export default async function workoutSplitRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  app.get('/workout-splits', async (request) => {
    return prisma.workoutSplit.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
    })
  })

  // Every log of every routine, newest first: what the training screens load
  // (the streak counts all of them), in one request rather than one per routine.
  app.get('/workout-splits/logs', async (request) => {
    return prisma.splitLog.findMany({
      where: { userId: request.userId },
      orderBy: { loggedAt: 'desc' },
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

  // Edit a routine in place: name, days (renamed, added, moved, or removed when
  // nothing was logged on them), goal and styles. Past training days are
  // renumbered in the same transaction, so a logged "Pull" stays Pull.
  app.put<{ Params: { id: string } }>('/workout-splits/:id', async (request, reply) => {
    const parsed = editSplitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }
    const { days, dayColors, dayIcons, ...rest } = parsed.data

    const split = await prisma.workoutSplit.findFirst({ where: { id: request.params.id, userId: request.userId } })
    if (!split) {
      return reply.notFound()
    }
    const froms = days.flatMap((d) => (d.from == null ? [] : [d.from]))
    if (froms.some((from) => from >= split.days.length) || new Set(froms).size !== froms.length) {
      return reply.badRequest('Each day can come from one existing day at most')
    }
    const logged = await prisma.splitLog.groupBy({ by: ['dayIndex'], where: { splitId: split.id }, _count: true })
    const dropped = logged.find((l) => !froms.includes(l.dayIndex))
    if (dropped) {
      return reply.conflict(`"${split.days[dropped.dayIndex]}" has training logged, so it can't be removed`)
    }

    const names = new Set(days.map((d) => d.name))
    const keep = (map: Record<string, string> | undefined, saved: unknown) =>
      Object.fromEntries(Object.entries(map ?? (saved as Record<string, string> | null) ?? {}).filter(([day]) => names.has(day)))

    await prisma.$transaction(async (tx) => {
      // Two passes through negative numbers, so a swap never collides midway.
      for (const [to, day] of days.entries()) {
        if (day.from != null && day.from !== to) {
          await tx.splitLog.updateMany({ where: { splitId: split.id, dayIndex: day.from }, data: { dayIndex: -1 - to } })
        }
      }
      for (const [to, day] of days.entries()) {
        if (day.from != null && day.from !== to) {
          await tx.splitLog.updateMany({ where: { splitId: split.id, dayIndex: -1 - to }, data: { dayIndex: to } })
        }
      }
      await tx.workoutSplit.update({
        where: { id: split.id },
        data: { ...rest, days: days.map((d) => d.name), dayColors: keep(dayColors, split.dayColors), dayIcons: keep(dayIcons, split.dayIcons) },
      })
    })
    return prisma.workoutSplit.findUnique({ where: { id: split.id } })
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

    // One per calendar day across every routine: the calendar shows them all.
    const alreadyLogged = await prisma.splitLog.count({
      where: { userId: request.userId, loggedAt: { gte: dayStart, lt: dayEnd } },
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

  // Saving a session: the day's sets become exactly these, in one transaction,
  // so a failure leaves the old ones in place. Repeating it gives the same
  // result, so a retry is safe. A set without a time is placed on the day,
  // a millisecond apart, so the sets keep the order they were sent in.
  app.put<{ Params: { id: string; logId: string } }>('/workout-splits/:id/logs/:logId/sets', async (request, reply) => {
    const parsed = replaceSetsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const log = await prisma.splitLog.findFirst({
      where: { id: request.params.logId, splitId: request.params.id, userId: request.userId },
      select: { id: true, loggedAt: true },
    })
    if (!log) {
      return reply.notFound()
    }

    return prisma.$transaction(async (tx) => {
      await tx.workoutSet.deleteMany({ where: { splitLogId: log.id, userId: request.userId } })
      await tx.workoutSet.createMany({
        data: parsed.data.sets.map((set, i) => ({
          ...set,
          performedAt: set.performedAt ?? new Date(log.loggedAt.getTime() + i),
          userId: request.userId,
          splitLogId: log.id,
        })),
      })
      return tx.workoutSet.findMany({ where: { splitLogId: log.id }, orderBy: { performedAt: 'desc' } })
    })
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
