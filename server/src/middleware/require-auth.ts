import type { FastifyReply, FastifyRequest } from 'fastify'
import { bearerToken, userIdForToken } from '../auth/tokens.ts'

// Signed in by the session cookie (browser) or a Bearer token (mobile app).
// Either way the user ends up on request.userId, which is what routes read.
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = bearerToken(request.headers.authorization)
  const userId = token ? await userIdForToken(token) : request.session.userId

  if (!userId) {
    return reply.code(401).send({ error: 'Not authenticated' })
  }
  request.userId = userId
}
