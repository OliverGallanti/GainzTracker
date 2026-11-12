import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.ts'
import { clientId, repliedWithExisting } from '../lib/client-id.ts'
import { prisma } from '../db.ts'

const createSchema = z.object({
  id: clientId,
  description: z.string().min(1),
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  mealName: z.string().trim().min(1).max(30).optional(),
  amount: z.number().positive().optional(),
  unit: z.enum(['g', 'serving']).optional(),
  loggedAt: z.coerce.date().optional(),
})

// Any subset; a macro, mealName, amount or unit sent as null is cleared
// (mealName null = "Other").
const updateSchema = z.object({
  description: z.string().min(1).optional(),
  calories: z.number().int().nonnegative().optional(),
  proteinG: z.number().nonnegative().nullable().optional(),
  carbsG: z.number().nonnegative().nullable().optional(),
  fatG: z.number().nonnegative().nullable().optional(),
  mealName: z.string().trim().min(1).max(30).nullable().optional(),
  amount: z.number().positive().nullable().optional(),
  unit: z.enum(['g', 'serving']).nullable().optional(),
})

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
