import * as client from 'openid-client'
import { getGoogleOidcConfig } from '../auth/oidc-client.js'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../auth/session-plugin.js'
import { config, isProduction } from '../config.js'
import { prisma } from '../db.js'

const OAUTH_STATE_COOKIE = 'oauth_state'
const OAUTH_STATE_MAX_AGE_SECONDS = 300

export default async function authRoutes(app) {
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

    reply.redirect(authorizationUrl.href)
  })

  app.get('/google/callback', async (request, reply) => {
    const rawCookie = request.cookies[OAUTH_STATE_COOKIE]
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/' })

    if (!rawCookie) {
      return reply.badRequest('Missing OAuth state — please try signing in again')
    }

    const unsigned = request.unsignCookie(rawCookie)
    if (!unsigned.valid) {
      return reply.badRequest('Invalid OAuth state — please try signing in again')
    }

    const { state: expectedState, codeVerifier } = JSON.parse(unsigned.value)

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
      return reply.badRequest('Sign-in failed — please try again')
    }

    const claims = tokens.claims()

    const user = await prisma.user.upsert({
      where: { googleId: claims.sub },
      update: {
        email: claims.email,
        name: claims.name ?? null,
        avatarUrl: claims.picture ?? null,
      },
      create: {
        googleId: claims.sub,
        email: claims.email,
        name: claims.name ?? null,
        avatarUrl: claims.picture ?? null,
      },
    })

    request.session.set('userId', user.id)
    await request.session.save()

    reply.redirect(config.FRONTEND_URL)
  })

  app.post('/logout', async (request, reply) => {
    await request.session.destroy()
    // session.destroy() nulls out request.session, so @fastify/session's onSend
    // hook has nothing to act on and won't clear the browser's cookie itself.
    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: sessionCookieOptions.path,
      domain: sessionCookieOptions.domain,
    })
    reply.code(204).send()
  })
}
