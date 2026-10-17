import { prisma } from '../db.ts'

// Finds or creates the user for a verified Google identity, refreshing the
// profile fields on every sign-in. Shared by the browser (OAuth redirect) and
// mobile (ID token) logins. Null when the email already belongs to a different
// account: an address can move between Google accounts, so a new `sub` can
// arrive carrying an email another row holds.
export async function upsertGoogleUser(identity: {
  sub: string
  email: string
  name: string | null
  picture: string | null
}) {
  const profile = { email: identity.email, name: identity.name, avatarUrl: identity.picture }
  try {
    return await prisma.user.upsert({
      where: { googleId: identity.sub },
      update: profile,
      create: { googleId: identity.sub, ...profile },
    })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return null
    throw err
  }
}
