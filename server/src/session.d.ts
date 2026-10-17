// What this app stores on the session (set at login, read by requireAuth and every route).
import 'fastify'

declare module 'fastify' {
  interface Session {
    // Typed as always present: every route that reads it sits behind requireAuth,
    // which rejects the request first when it is missing. Login routes only set it.
    userId: string
  }
}
