import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/require-auth.ts'
import { prisma } from '../db.ts'

const userSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  heightCm: true,
  weightGoalKg: true,
  bodyFatGoalPercent: true,
  sex: true,
  age: true,
  activityLevel: true,
  mealNames: true,
}

// Must match the keys in src/lib/tdee.ts's ACTIVITY_LEVELS on the client.
const ACTIVITY_LEVEL_KEYS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const

// A general profile-update endpoint: every field is optional and only the
// keys actually present in the body get written, so editing one (e.g. just
// height) never requires resending the others (e.g. goals).
const updateSchema = z
  .object({
    heightCm: z.number().positive().optional(),
    weightGoalKg: z.number().positive().optional(),
    bodyFatGoalPercent: z.number().min(0).max(100).optional(),
    sex: z.enum(['male', 'female']).optional(),
    age: z.number().int().positive().max(120).optional(),
    activityLevel: z.enum(ACTIVITY_LEVEL_KEYS).optional(),
    // The whole ordered list replaces the old one. Names are matched by
    // MacroEntry.mealName, so they must be unique within the list.
    mealNames: z
      .array(z.string().trim().min(1).max(30))
      .min(1)
      .max(8)
      .refine((names) => new Set(names).size === names.length, { message: 'Meal names must be unique' })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' })

export default async function meRoutes(app: FastifyInstance) {
  app.get('/me', { onRequest: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.session.userId },
      select: userSelect,
    })

    if (!user) {
      return reply.code(401).send({ error: 'Not authenticated' })
    }

    return user
  })

  app.put('/me', { onRequest: requireAuth }, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    const user = await prisma.user.update({
      where: { id: request.session.userId },
      data: parsed.data,
      select: userSelect,
    })
    return user
  })
}
