import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

// Google's signing keys, fetched once and cached by jose (it refetches on an
// unknown key id, which is how Google key rotation is picked up).
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export interface GoogleIdentity {
  sub: string
  email: string
  name: string | null
  picture: string | null
}

export class InvalidIdTokenError extends Error {}

// Verifies an ID token from native Google Sign-In (the mobile app). The app asks
// for the token with the WEB client id, so the audience is the same
// GOOGLE_CLIENT_ID the browser login uses. Signature, issuer, audience and expiry
// are checked by jose; the claims we rely on are checked here, since they're
// untyped JSON. `keys` is injectable for tests only.
// (`audience` is a parameter rather than read from config so tests can import
// this module without the server environment.)
export async function verifyGoogleIdToken(
  idToken: string,
  audience: string,
  keys: JWTVerifyGetKey = googleKeys,
): Promise<GoogleIdentity> {
  let payload
  try {
    ;({ payload } = await jwtVerify(idToken, keys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience,
    }))
  } catch {
    throw new InvalidIdTokenError('ID token is invalid or expired')
  }

  // Same rule as the browser login: an unverified address isn't an identity.
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || payload.email_verified !== true) {
    throw new InvalidIdTokenError('Your Google account needs a verified email address to sign in')
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : null,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  }
}
