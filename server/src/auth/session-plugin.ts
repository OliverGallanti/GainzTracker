import type { FastifyInstance } from 'fastify'
import fastifySession from '@fastify/session'
import fp from 'fastify-plugin'
import { config, isProduction } from '../config.ts'
import { PrismaSessionStore } from './prisma-session-store.ts'

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7

export const SESSION_COOKIE_NAME = 'gt_session'

export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  domain: config.COOKIE_DOMAIN || undefined,
}

export default fp(async function sessionPlugin(app: FastifyInstance) {
  await app.register(fastifySession, {
    secret: config.SESSION_SECRET,
    store: new PrismaSessionStore(),
    cookieName: SESSION_COOKIE_NAME,
    cookie: {
      ...sessionCookieOptions,
      maxAge: SEVEN_DAYS_MS,
    },
    saveUninitialized: false,
  })
})
