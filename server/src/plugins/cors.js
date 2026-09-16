import cors from '@fastify/cors'
import fp from 'fastify-plugin'
import { config } from '../config.js'

export default fp(async function corsPlugin(app) {
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
  })
})
