import cookie from '@fastify/cookie'
import fp from 'fastify-plugin'
import { config } from '../config.js'

export default fp(async function cookiePlugin(app) {
  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  })
})
