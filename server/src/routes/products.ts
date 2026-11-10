import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.ts'
import { lookupProduct, searchProducts } from '../lib/open-food-facts.ts'

// EAN-8 up to GTIN-14 — every retail barcode format a scanner produces. Also keeps
// arbitrary text out of the URL we build for the upstream request.
const BARCODE = /^\d{8,14}$/

export default async function productRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth)

  // Proxied through the BFF rather than called from the browser so the upstream
  // User-Agent is ours and the provider can be swapped without touching the client.
  // 200 + null when the barcode is unknown (a normal outcome, like /macro-goal
  // with no goal); 502 only when the food database itself can't be reached.
  // Search by name, for foods without a barcode at hand (fruit, bakery...).
  // Registered before /:barcode only for readability: Fastify matches the static
  // segment first either way.
  app.get<{ Querystring: { q?: string } }>('/products/search', async (request, reply) => {
    const q = request.query.q?.trim() ?? ''
    if (q.length < 2 || q.length > 100) {
      return reply.badRequest('Search for 2 to 100 characters')
    }

    try {
      return await searchProducts(q)
    } catch (err) {
      request.log.warn({ err }, 'Open Food Facts search failed')
      return reply.badGateway('The food database is unavailable')
    }
  })

  app.get<{ Params: { barcode: string } }>('/products/:barcode', async (request, reply) => {
    const { barcode } = request.params
    if (!BARCODE.test(barcode)) {
      return reply.badRequest('Barcode must be 8 to 14 digits')
    }

    try {
      return await lookupProduct(barcode)
    } catch (err) {
      request.log.warn({ err }, 'Open Food Facts lookup failed')
      return reply.badGateway('The food database is unavailable')
    }
  })
}
