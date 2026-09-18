import { requireAuth } from '../middleware/require-auth.js'
import { lookupProduct } from '../lib/open-food-facts.js'

// EAN-8 up to GTIN-14 — every retail barcode format a scanner produces. Also keeps
// arbitrary text out of the URL we build for the upstream request.
const BARCODE = /^\d{8,14}$/

export default async function productRoutes(app) {
  app.addHook('onRequest', requireAuth)

  // Proxied through the BFF rather than called from the browser so the upstream
  // User-Agent is ours and the provider can be swapped without touching the client.
  // 200 + null when the barcode is unknown (a normal outcome, like /macro-goal
  // with no goal); 502 only when the food database itself can't be reached.
  app.get('/products/:barcode', async (request, reply) => {
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
