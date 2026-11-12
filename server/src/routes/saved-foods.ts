import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.ts'
import { prisma } from '../db.ts'

const saveSchema = z.object({
  name: z.string().trim().min(1).max(80),
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  basis: z.enum(['serving', '100g']).default('serving'),
  servingG: z.number().positive().optional(),
})

const isDuplicateName = (err: unknown) => (err as { code?: string }).code === 'P2002'

export default async function savedFoodRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  app.get('/saved-foods', async (request) => {
    return prisma.savedFood.findMany({
      where: { userId: request.userId },
      orderBy: { name: 'asc' },
    })
  })

  // Upsert by name: saving "Chili" again replaces its macros instead of failing
  // on the (userId, name) unique index or piling up near-duplicates. A macro left
  // out of the request becomes null rather than keeping the old value.
  app.post('/saved-foods', async (request, reply) => {
    const parsed = saveSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const userId = request.userId
    const { name, calories, proteinG = null, carbsG = null, fatG = null, basis, servingG = null } = parsed.data
    const data = { calories, proteinG, carbsG, fatG, basis, servingG }
    const food = await prisma.savedFood.upsert({
      where: { userId_name: { userId, name } },
      create: { ...data, name, userId },
      update: data,
    })
    return reply.code(201).send(food)
  })

  // Replace a saved food, name included (a rename can collide with another one).
  app.put<{ Params: { id: string } }>('/saved-foods/:id', async (request, reply) => {
    const parsed = saveSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const { proteinG = null, carbsG = null, fatG = null, servingG = null, ...rest } = parsed.data
    try {
      const { count } = await prisma.savedFood.updateMany({
        where: { id: request.params.id, userId: request.userId },
        data: { ...rest, proteinG, carbsG, fatG, servingG },
      })
      if (count === 0) {
        return reply.notFound()
      }
    } catch (err) {
      if (isDuplicateName(err)) return reply.conflict('You already have a saved food with that name')
      throw err
    }
    return reply.code(204).send()
  })

  app.delete<{ Params: { id: string } }>('/saved-foods/:id', async (request, reply) => {
    const { count } = await prisma.savedFood.deleteMany({
      where: { id: request.params.id, userId: request.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
