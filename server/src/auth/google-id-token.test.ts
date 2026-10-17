import { describe, expect, it } from 'vitest'
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { InvalidIdTokenError, verifyGoogleIdToken } from './google-id-token.ts'
import { bearerToken } from './tokens.ts'

// A local key pair stands in for Google's signing keys.
const AUDIENCE = 'test-client-id.apps.googleusercontent.com'
const { privateKey, publicKey } = await generateKeyPair('RS256')
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }] })

const sign = (claims: Record<string, unknown>, { audience = AUDIENCE, issuer = 'https://accounts.google.com', expiresIn = '1h', key = privateKey } = {}) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)

const good = { sub: '123', email: 'a@example.com', email_verified: true, name: 'A', picture: 'https://x/p.png' }

describe('verifyGoogleIdToken', () => {
  it('returns the identity from a valid token', async () => {
    expect(await verifyGoogleIdToken(await sign(good), AUDIENCE, keys)).toEqual({
      sub: '123',
      email: 'a@example.com',
      name: 'A',
      picture: 'https://x/p.png',
    })
  })

  it('accepts the bare issuer form Google also uses, and missing name/picture', async () => {
    const token = await sign({ sub: '1', email: 'b@example.com', email_verified: true }, { issuer: 'accounts.google.com' })
    expect(await verifyGoogleIdToken(token, AUDIENCE, keys)).toMatchObject({ name: null, picture: null })
  })

  const rejects = async (token: Promise<string>) =>
    expect(verifyGoogleIdToken(await token, AUDIENCE, keys)).rejects.toBeInstanceOf(InvalidIdTokenError)

  it('rejects a token meant for another app (audience)', () => rejects(sign(good, { audience: 'someone-else' })))
  it('rejects a token not issued by Google', () => rejects(sign(good, { issuer: 'https://evil.example' })))
  it('rejects an expired token', () => rejects(sign(good, { expiresIn: '-1m' })))
  it('rejects a token signed with another key', async () => {
    const other = await generateKeyPair('RS256')
    await rejects(sign(good, { key: other.privateKey }))
  })
  it('rejects garbage', () => rejects(Promise.resolve('not-a-jwt')))
  it('rejects an unverified email', () => rejects(sign({ ...good, email_verified: false })))
  it('rejects a missing or non-string email', async () => {
    await rejects(sign({ sub: '1', email_verified: true }))
    await rejects(sign({ ...good, email: 42 }))
  })
})

describe('bearerToken', () => {
  it('reads the token from an Authorization header', () => {
    expect(bearerToken('Bearer abc_DEF-123')).toBe('abc_DEF-123')
  })

  it('ignores anything else', () => {
    expect(bearerToken(undefined)).toBeNull()
    expect(bearerToken('Basic abc')).toBeNull()
    expect(bearerToken('Bearer ')).toBeNull()
    expect(bearerToken('Bearer a b')).toBeNull()
  })
})
