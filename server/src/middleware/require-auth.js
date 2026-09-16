export async function requireAuth(request, reply) {
  if (!request.session.userId) {
    reply.code(401).send({ error: 'Not authenticated' })
  }
}
