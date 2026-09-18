import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../db.js'

const saveSchema = z.object({
  name: z.string().trim().min(1).max(80),
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
})

export default async function savedFoodRoutes(app) {
  app.addHook('onRequest', requireAuth)

  app.get('/saved-foods', async (request) => {
    return prisma.savedFood.findMany({
      where: { userId: request.session.userId },
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

    const userId = request.session.userId
    const { name, calories, proteinG = null, carbsG = null, fatG = null } = parsed.data
    const data = { calories, proteinG, carbsG, fatG }
    const food = await prisma.savedFood.upsert({
      where: { userId_name: { userId, name } },
      create: { ...data, name, userId },
      update: data,
    })
    return reply.code(201).send(food)
  })

  app.delete('/saved-foods/:id', async (request, reply) => {
    const { count } = await prisma.savedFood.deleteMany({
      where: { id: request.params.id, userId: request.session.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
