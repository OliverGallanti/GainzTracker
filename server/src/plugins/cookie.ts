import type { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import fp from 'fastify-plugin'
import { config } from '../config.ts'

export default fp(async function cookiePlugin(app: FastifyInstance) {
  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  })
})
