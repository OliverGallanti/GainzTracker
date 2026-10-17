import type { FastifyReply } from 'fastify'
import { z } from 'zod'

// An offline client (the mobile app) creates records with an id it made itself
// and may send the same create again after a dropped connection. Accepting that
// id makes the retry safe: the second request finds the first row and returns it
// instead of creating a duplicate. The browser doesn't send one; the database
// default id is used then.
export const clientId = z.string().uuid().optional()

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
