// What the web footer and the phone's About card show. The version is the whole
// product's (web, server and phone release together); it must match the root
// package.json, which about.test.ts checks. See "Releasing" in the README.
export const APP_VERSION = '1.2.0'

export const AUTHOR = 'Oliver Gallanti'
export const AUTHOR_LINKS = [
  { name: 'Portfolio', url: 'https://olivergallanti.vercel.app/' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/olivergallanti/' },
]

export type Credit = { name: string; url: string; note?: string }

// Open Food Facts is listed with its licence because ODbL requires
// attribution; the rest is credit where it's due. Each app adds its own list.
export const FOOD_DATA_CREDITS: Credit[] = [
  {
    name: 'Open Food Facts',
    url: 'https://world.openfoodfacts.org',
    note: 'Food search and barcode lookups. Community-edited data, available under the Open Database License (ODbL).',
  },
]

export const SERVER_CREDITS: Credit[] = [
  { name: 'Fastify', url: 'https://fastify.dev' },
  { name: 'Prisma', url: 'https://www.prisma.io' },
  { name: 'PostgreSQL', url: 'https://www.postgresql.org' },
  { name: 'Zod', url: 'https://zod.dev' },
  { name: 'SimpleWebAuthn', url: 'https://simplewebauthn.dev', note: 'passkeys' },
]
