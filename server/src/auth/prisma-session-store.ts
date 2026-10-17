import type { Prisma } from '@prisma/client'
import { prisma } from '../db.ts'

import type { SessionStore } from '@fastify/session'
import type { Session } from 'fastify'

type Callback = Parameters<SessionStore['set']>[2]

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7

// A @fastify/session-compatible store backed by the Session Prisma model,
// so sessions are revocable server-side without adding Redis.
//
// Each method calls its callback exactly once, outside the try block: the
// callback resumes Fastify's request pipeline, so a synchronous throw from
// downstream would otherwise be caught here and reported as a store failure.
export class PrismaSessionStore implements SessionStore {
  async set(sessionId: string, session: Session, callback: Callback) {
    try {
      const expiresAt = new Date(session.cookie.expires ?? Date.now() + SEVEN_DAYS_MS)
      const userId = session.userId ?? null
      await prisma.session.upsert({
        where: { id: sessionId },
        update: { data: session as unknown as Prisma.InputJsonValue, expiresAt, userId },
        create: { id: sessionId, data: session as unknown as Prisma.InputJsonValue, expiresAt, userId },
      })
    } catch (err) {
      return callback(err)
    }
    callback()
  }

  async get(sessionId: string, callback: Parameters<SessionStore['get']>[1]) {
    let record
    try {
      record = await prisma.session.findUnique({ where: { id: sessionId } })
    } catch (err) {
      return callback(err)
    }

    if (!record || record.expiresAt < new Date()) {
      return callback(null, null)
    }
    callback(null, record.data as unknown as Session)
  }

  async destroy(sessionId: string, callback: Callback) {
    try {
      await prisma.session.deleteMany({ where: { id: sessionId } })
    } catch (err) {
      return callback(err)
    }
    callback()
  }
}
