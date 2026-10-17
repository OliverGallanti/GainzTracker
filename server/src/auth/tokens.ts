import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../db.ts'

const NINETY_DAYS_MS = 1000 * 60 * 60 * 24 * 90

// Only the hash is stored (see the AuthToken model).
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export async function issueToken(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + NINETY_DAYS_MS)
  await prisma.authToken.create({ data: { id: hash(token), userId, expiresAt } })
  return { token, expiresAt }
}

// The user the token belongs to, or null if it's unknown or expired.
export async function userIdForToken(token: string) {
  const row = await prisma.authToken.findUnique({ where: { id: hash(token) } })
  return row && row.expiresAt > new Date() ? row.userId : null
}

export async function revokeToken(token: string) {
  await prisma.authToken.deleteMany({ where: { id: hash(token) } })
}

// "Authorization: Bearer <token>" -> the token, or null.
export function bearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]+)$/)
  return match ? match[1] : null
}
