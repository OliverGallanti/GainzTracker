// What this app stores on the session, and what requireAuth puts on the request.
import 'fastify'

declare module 'fastify' {
  interface Session {
    // Set at login (Google or passkey); absent on an anonymous session.
    userId?: string
  }

  interface FastifyRequest {
    // The signed-in user, from the session cookie or a Bearer token. Set by
    // requireAuth, so it's only meaningful on routes behind it.
    userId: string
  }
}
