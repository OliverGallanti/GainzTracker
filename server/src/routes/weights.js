import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../db.js'

const createSchema = z.object({
  weightKg: z.number().positive(),
  loggedAt: z.coerce.date().optional(),
  note: z.string().optional(),
})

export default async function weightRoutes(app) {
  app.addHook('onRequest', requireAuth)

  app.get('/weights', async (request) => {
    return prisma.weightEntry.findMany({
      where: { userId: request.session.userId },
      orderBy: { loggedAt: 'desc' },
    })
  })

  app.post('/weights', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const entry = await prisma.weightEntry.create({
      data: { ...parsed.data, userId: request.session.userId },
    })
    return reply.code(201).send(entry)
  })

  app.delete('/weights/:id', async (request, reply) => {
    const { count } = await prisma.weightEntry.deleteMany({
      where: { id: request.params.id, userId: request.session.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
