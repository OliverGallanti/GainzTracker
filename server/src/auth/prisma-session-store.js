import { prisma } from '../db.js'

// A @fastify/session-compatible store backed by the Session Prisma model,
// so sessions are revocable server-side without adding Redis.
export class PrismaSessionStore {
  async set(sessionId, session, callback) {
    try {
      const expiresAt = new Date(session.cookie.expires ?? Date.now() + 1000 * 60 * 60 * 24 * 7)
      const userId = session.userId ?? null
      await prisma.session.upsert({
        where: { id: sessionId },
        update: { data: session, expiresAt, userId },
        create: { id: sessionId, data: session, expiresAt, userId },
      })
      callback()
    } catch (err) {
      callback(err)
    }
  }

  async get(sessionId, callback) {
    try {
      const record = await prisma.session.findUnique({ where: { id: sessionId } })
      if (!record || record.expiresAt < new Date()) {
        return callback(null, null)
      }
      callback(null, record.data)
    } catch (err) {
      callback(err)
    }
  }

  async destroy(sessionId, callback) {
    try {
      await prisma.session.deleteMany({ where: { id: sessionId } })
      callback()
    } catch (err) {
      callback(err)
    }
  }
}
