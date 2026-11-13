import type { FastifyReply } from 'fastify'

// The client-made id itself is validated by `clientId` in @gainz/shared/schemas.

// Call before creating. If a row with the client's id already exists, replies
// (200 with that row, or 409 if it belongs to someone else) and returns true.
// ponytail: two identical requests at the exact same moment both pass this check
// and one fails on the primary key (500). Retries are sequential, so that's fine.
export function repliedWithExisting(
  reply: FastifyReply,
  userId: string,
  existing: { userId: string | null } | null,
) {
  if (!existing) return false
  if (existing.userId === userId) reply.code(200).send(existing)
  else reply.conflict('That id is already in use')
  return true
}
