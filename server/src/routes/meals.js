import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../db.js'

const createSchema = z.object({
  description: z.string().min(1),
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  mealName: z.string().trim().min(1).max(30).optional(),
  loggedAt: z.coerce.date().optional(),
})

const moveSchema = z.object({ mealName: z.string().trim().min(1).max(30).nullable() })

const listQuerySchema = z.object({
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
})

export default async function mealRoutes(app) {
  app.addHook('onRequest', requireAuth)

  app.get('/meals', async (request, reply) => {
    const parsedQuery = listQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return reply.badRequest(parsedQuery.error.message)
    }
    const { since, until } = parsedQuery.data

    return prisma.macroEntry.findMany({
      where: {
        userId: request.session.userId,
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

    const entry = await prisma.macroEntry.create({
      data: { ...parsed.data, userId: request.session.userId },
    })
    return reply.code(201).send(entry)
  })

  // Move a food to another meal slot; null = "Other".
  app.patch('/meals/:id', async (request, reply) => {
    const parsed = moveSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const { count } = await prisma.macroEntry.updateMany({
      where: { id: request.params.id, userId: request.session.userId },
      data: parsed.data,
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })

  app.delete('/meals/:id', async (request, reply) => {
    const { count } = await prisma.macroEntry.deleteMany({
      where: { id: request.params.id, userId: request.session.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
