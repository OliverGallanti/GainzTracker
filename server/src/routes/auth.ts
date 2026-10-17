import type { FastifyInstance } from 'fastify'
import * as client from 'openid-client'
import { getGoogleOidcConfig } from '../auth/oidc-client.ts'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../auth/session-plugin.ts'
import { config, isProduction } from '../config.ts'
import { InvalidIdTokenError, verifyGoogleIdToken } from '../auth/google-id-token.ts'
import { upsertGoogleUser } from '../auth/google-user.ts'
import { bearerToken, issueToken, revokeToken } from '../auth/tokens.ts'
import { z } from 'zod'

const tokenLoginSchema = z.object({ idToken: z.string().min(1).max(4096) })

const OAUTH_STATE_COOKIE = 'oauth_state'
const OAUTH_STATE_MAX_AGE_SECONDS = 300

export default async function authRoutes(app: FastifyInstance) {
  app.get('/google', async (request, reply) => {
    const oidcConfig = await getGoogleOidcConfig()

    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    reply.setCookie(OAUTH_STATE_COOKIE, JSON.stringify({ state, codeVerifier }), {
      signed: true,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    })

    const authorizationUrl = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: config.GOOGLE_REDIRECT_URI,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return reply.redirect(authorizationUrl.href)
  })

  app.get('/google/callback', async (request, reply) => {
    const rawCookie = request.cookies[OAUTH_STATE_COOKIE]
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/' })

    if (!rawCookie) {
      return reply.badRequest('Missing OAuth state: please try signing in again')
    }

    const unsigned = request.unsignCookie(rawCookie)
    if (!unsigned.valid) {
      return reply.badRequest('Invalid OAuth state: please try signing in again')
    }

    let expectedState
    let codeVerifier
    try {
      ({ state: expectedState, codeVerifier } = JSON.parse(unsigned.value))
    } catch {
      return reply.badRequest('Invalid OAuth state: please try signing in again')
    }

    const oidcConfig = await getGoogleOidcConfig()
    const currentUrl = new URL(request.url, config.GOOGLE_REDIRECT_URI)

    let tokens
    try {
      tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState,
      })
    } catch (err) {
      request.log.error(err, 'Google OAuth code exchange failed')
      return reply.badRequest('Sign-in failed: please try again')
    }

    const claims = tokens.claims()

    // Google can return an unverified address on some account types; treating one
    // as an identity would let someone claim an email they don't control.
    if (!claims || typeof claims.email !== 'string' || !claims.email || claims.email_verified !== true) {
      return reply.badRequest('Your Google account needs a verified email address to sign in')
    }

    const user = await upsertGoogleUser({
      sub: claims.sub,
      email: claims.email,
      name: typeof claims.name === 'string' ? claims.name : null,
      picture: typeof claims.picture === 'string' ? claims.picture : null,
    })
    if (!user) {
      request.log.warn({ googleId: claims.sub }, 'Sign-in blocked: email belongs to another account')
      return reply.conflict('That email address is already linked to a different account')
    }

    // Issue a fresh session ID now that this session is being elevated to a
    // logged-in user, so a pre-existing ID can't be replayed by whoever set it.
    await request.session.regenerate()
    request.session.set('userId', user.id)
    await request.session.save()

    return reply.redirect(config.FRONTEND_URL)
  })

  // Mobile sign-in: the app gets an ID token from native Google Sign-In and trades
  // it for a Bearer token here (a phone app can't use the browser redirect flow
  // or rely on cookies). No session or cookie is created.
  app.post('/google/token', async (request, reply) => {
    const parsed = tokenLoginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message)
    }

    let identity
    try {
      identity = await verifyGoogleIdToken(parsed.data.idToken, config.GOOGLE_CLIENT_ID)
    } catch (err) {
      if (err instanceof InvalidIdTokenError) return reply.unauthorized(err.message)
      throw err
    }

    const user = await upsertGoogleUser(identity)
    if (!user) {
      return reply.conflict('That email address is already linked to a different account')
    }

    const { token, expiresAt } = await issueToken(user.id)
    return reply.code(201).send({ token, expiresAt })
  })

  // Mobile sign-out. Always 204, so it can't be used to probe which tokens exist.
  app.delete('/token', async (request, reply) => {
    const token = bearerToken(request.headers.authorization)
    if (token) await revokeToken(token)
    return reply.code(204).send()
  })

  app.post('/logout', async (request, reply) => {
    await request.session.destroy()
    // session.destroy() nulls out request.session, so @fastify/session's onSend
    // hook has nothing to act on and won't clear the browser's cookie itself.
    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: sessionCookieOptions.path,
      domain: sessionCookieOptions.domain,
    })
    return reply.code(204).send()
  })
}
