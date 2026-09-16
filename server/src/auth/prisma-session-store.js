import { prisma } from '../db.js'

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7

// A @fastify/session-compatible store backed by the Session Prisma model,
// so sessions are revocable server-side without adding Redis.
//
// Each method calls its callback exactly once, outside the try block: the
// callback resumes Fastify's request pipeline, so a synchronous throw from
// downstream would otherwise be caught here and reported as a store failure.
export class PrismaSessionStore {
  async set(sessionId, session, callback) {
    try {
      const expiresAt = new Date(session.cookie.expires ?? Date.now() + SEVEN_DAYS_MS)
      const userId = session.userId ?? null
      await prisma.session.upsert({
        where: { id: sessionId },
        update: { data: session, expiresAt, userId },
        create: { id: sessionId, data: session, expiresAt, userId },
      })
    } catch (err) {
      return callback(err)
    }
    callback()
  }

  async get(sessionId, callback) {
    let record
    try {
      record = await prisma.session.findUnique({ where: { id: sessionId } })
    } catch (err) {
      return callback(err)
    }

    if (!record || record.expiresAt < new Date()) {
      return callback(null, null)
    }
    callback(null, record.data)
  }

  async destroy(sessionId, callback) {
    try {
      await prisma.session.deleteMany({ where: { id: sessionId } })
    } catch (err) {
      return callback(err)
    }
    callback()
  }
}
