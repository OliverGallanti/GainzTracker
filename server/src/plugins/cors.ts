import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import fp from 'fastify-plugin'
import { config } from '../config.ts'

export default fp(async function corsPlugin(app: FastifyInstance) {
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
  })
})
