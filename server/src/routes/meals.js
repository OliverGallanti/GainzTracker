import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../db.js'

const createSchema = z.object({
  description: z.string().min(1),
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  loggedAt: z.coerce.date().optional(),
})

export default async function mealRoutes(app) {
  app.addHook('onRequest', requireAuth)

  app.get('/meals', async (request) => {
    return prisma.macroEntry.findMany({
      where: { userId: request.session.userId },
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
