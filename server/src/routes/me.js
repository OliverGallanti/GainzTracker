import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../db.js'

export default async function meRoutes(app) {
  app.get('/me', { onRequest: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.session.userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    })

    if (!user) {
      return reply.code(401).send({ error: 'Not authenticated' })
    }

    return user
  })
}
