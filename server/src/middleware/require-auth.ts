import type { FastifyReply, FastifyRequest } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session.userId) {
    reply.code(401).send({ error: 'Not authenticated' })
  }
}
