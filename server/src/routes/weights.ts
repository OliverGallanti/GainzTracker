import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.ts'
import { repliedWithExisting } from '../lib/client-id.ts'
import { prisma } from '../db.ts'
import { createWeightSchema as createSchema } from '@gainz/shared/schemas'

const listQuerySchema = z.object({
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
})

export default async function weightRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  app.get('/weights', async (request, reply) => {
    const parsedQuery = listQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return reply.badRequest(parsedQuery.error.message)
    }
    const { since, until } = parsedQuery.data

    return prisma.weightEntry.findMany({
      where: {
        userId: request.userId,
        ...((since || until) && {
          loggedAt: { ...(since && { gte: since }), ...(until && { lte: until }) },
        }),
      },
      orderBy: { loggedAt: 'desc' },
    })
  })

  app.post('/weights', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    if (parsed.data.id) {
      const existing = await prisma.weightEntry.findUnique({ where: { id: parsed.data.id } })
      if (repliedWithExisting(reply, request.userId, existing)) return reply
    }

    const entry = await prisma.weightEntry.create({
      data: { ...parsed.data, userId: request.userId },
    })
    return reply.code(201).send(entry)
  })

  app.delete<{ Params: { id: string } }>('/weights/:id', async (request, reply) => {
    const { count } = await prisma.weightEntry.deleteMany({
      where: { id: request.params.id, userId: request.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
