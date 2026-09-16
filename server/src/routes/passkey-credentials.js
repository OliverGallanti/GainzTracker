import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../db.js'

export default async function passkeyCredentialRoutes(app) {
  app.addHook('onRequest', requireAuth)

  app.get('/passkeys', async (request) => {
    return prisma.credential.findMany({
      where: { userId: request.session.userId },
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.delete('/passkeys/:id', async (request, reply) => {
    const { count } = await prisma.credential.deleteMany({
      where: { id: request.params.id, userId: request.session.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
