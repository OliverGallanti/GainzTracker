import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.ts'
import { repliedWithExisting } from '../lib/client-id.ts'
import { prisma } from '../db.ts'
import { createMealSchema as createSchema, updateMealSchema as updateSchema } from '@gainz/shared/schemas'

const listQuerySchema = z.object({
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
})

export default async function mealRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  app.get('/meals', async (request, reply) => {
    const parsedQuery = listQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return reply.badRequest(parsedQuery.error.message)
    }
    const { since, until } = parsedQuery.data

    return prisma.macroEntry.findMany({
      where: {
        userId: request.userId,
        ...((since || until) && {
          loggedAt: { ...(since && { gte: since }), ...(until && { lte: until }) },
        }),
      },
      orderBy: { loggedAt: 'desc' },
    })
  })

  app.post('/meals', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    if (parsed.data.id) {
      const existing = await prisma.macroEntry.findUnique({ where: { id: parsed.data.id } })
      if (repliedWithExisting(reply, request.userId, existing)) return reply
    }

    const entry = await prisma.macroEntry.create({
      data: { ...parsed.data, userId: request.userId },
    })
    return reply.code(201).send(entry)
  })

  // Edit a logged food: move it to another meal, change the amount or values.
  app.patch<{ Params: { id: string } }>('/meals/:id', async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const { count } = await prisma.macroEntry.updateMany({
      where: { id: request.params.id, userId: request.userId },
      data: parsed.data,
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })

  app.delete<{ Params: { id: string } }>('/meals/:id', async (request, reply) => {
    const { count } = await prisma.macroEntry.deleteMany({
      where: { id: request.params.id, userId: request.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
