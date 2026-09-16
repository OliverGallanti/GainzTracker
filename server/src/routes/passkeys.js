import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoUint8Array } from '@simplewebauthn/server/helpers'
import { requireAuth } from '../middleware/require-auth.js'
import {
  AUTHENTICATION_CHALLENGE_COOKIE,
  CHALLENGE_MAX_AGE_SECONDS,
  REGISTRATION_CHALLENGE_COOKIE,
  expectedOrigin,
  rpID,
  rpName,
} from '../auth/webauthn.js'
import { isProduction } from '../config.js'
import { prisma } from '../db.js'

const challengeCookieOptions = {
  signed: true,
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: CHALLENGE_MAX_AGE_SECONDS,
}

function readChallengeCookie(request, reply, cookieName) {
  const raw = request.cookies[cookieName]
  reply.clearCookie(cookieName, { path: '/' })
  if (!raw) return null
  const unsigned = request.unsignCookie(raw)
  return unsigned.valid ? unsigned.value : null
}

export default async function passkeyRoutes(app) {
  app.post('/registration/options', { onRequest: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.session.userId } })
    if (!user) {
      return reply.unauthorized('Not authenticated')
    }

    const existingCredentials = await prisma.credential.findMany({
      where: { userId: user.id },
      select: { id: true, transports: true },
    })

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: isoUint8Array.fromUTF8String(user.id),
      userName: user.email,
      userDisplayName: user.name ?? user.email,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((c) => ({ id: c.id, transports: c.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    })

    reply.setCookie(REGISTRATION_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions)
    return options
  })

  app.post('/registration/verify', { onRequest: requireAuth }, async (request, reply) => {
    const expectedChallenge = readChallengeCookie(request, reply, REGISTRATION_CHALLENGE_COOKIE)
    if (!expectedChallenge) {
      return reply.badRequest('Missing or invalid registration challenge — please try again')
    }

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: request.body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      })
    } catch (err) {
      request.log.warn(err, 'Passkey registration verification threw')
      return reply.badRequest('Could not verify passkey — please try again')
    }

    if (!verification.verified || !verification.registrationInfo) {
      return reply.badRequest('Could not verify passkey — please try again')
    }

    const { credential } = verification.registrationInfo

    try {
      await prisma.credential.create({
        data: {
          id: credential.id,
          userId: request.session.userId,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports ?? [],
        },
      })
    } catch (err) {
      if (err.code === 'P2002') {
        return reply.conflict('This passkey is already registered')
      }
      throw err
    }

    return reply.code(201).send({ ok: true })
  })

  app.post('/authentication/options', async (request, reply) => {
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    })

    reply.setCookie(AUTHENTICATION_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions)
    return options
  })

  // Unauthenticated by design — this IS the login endpoint. Safe because: (1) the
  // sameSite:'lax' challenge cookie won't ride along on a forged cross-site POST,
  // and (2) a WebAuthn assertion is cryptographically bound to the origin and
  // challenge by the authenticator itself, so nothing here can be forged without
  // the private key that never leaves the user's device.
  app.post('/authentication/verify', async (request, reply) => {
    const expectedChallenge = readChallengeCookie(request, reply, AUTHENTICATION_CHALLENGE_COOKIE)
    if (!expectedChallenge) {
      return reply.badRequest('Missing or invalid authentication challenge — please try again')
    }

    const credentialId = request.body?.id
    if (typeof credentialId !== 'string' || !credentialId) {
      return reply.badRequest('Malformed passkey response')
    }

    const stored = await prisma.credential.findUnique({ where: { id: credentialId } })
    // Same generic message whether the credential doesn't exist or verification
    // fails below, so this never becomes an oracle for which credential IDs exist.
    if (!stored) {
      return reply.unauthorized('Authentication failed')
    }

    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response: request.body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: stored.id,
          publicKey: stored.publicKey,
          counter: Number(stored.counter),
          transports: stored.transports,
        },
      })
    } catch (err) {
      request.log.warn(err, 'Passkey authentication verification threw')
      return reply.unauthorized('Authentication failed')
    }

    if (!verification.verified) {
      return reply.unauthorized('Authentication failed')
    }

    // Same fixation-safe sequence as the Google login flow: issue a fresh
    // session ID before elevating it, so a pre-existing session can't be
    // replayed by whoever set it.
    await request.session.regenerate()
    request.session.set('userId', stored.userId)
    await request.session.save()

    await prisma.credential.update({
      where: { id: stored.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    })

    return reply.code(200).send({ ok: true })
  })
}
