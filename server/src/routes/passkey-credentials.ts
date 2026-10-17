import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.ts'
import { prisma } from '../db.ts'

export default async function passkeyCredentialRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  app.get('/passkeys', async (request) => {
    return prisma.credential.findMany({
      where: { userId: request.userId },
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.delete<{ Params: { id: string } }>('/passkeys/:id', async (request, reply) => {
    const { count } = await prisma.credential.deleteMany({
      where: { id: request.params.id, userId: request.userId },
    })
    if (count === 0) {
      return reply.notFound()
    }
    return reply.code(204).send()
  })
}
