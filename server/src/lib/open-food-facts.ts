// Open Food Facts (https://world.openfoodfacts.org) — a free, open, crowd-sourced
// product database, no API key. Their terms ask for an identifying User-Agent, and
// the data is ODbL-licensed: credit it wherever it's shown.
const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'
// Search by name: OFF's newer search service. The classic cgi/search.pl answers
// 503 under load, and its rate limit (10/min per IP) would be shared by every user.
const SEARCH_URL = 'https://search.openfoodfacts.org/search'
const FIELDS = 'product_name,brands,serving_size,serving_quantity,nutriments'
const SEARCH_RESULTS = 10
const USER_AGENT = 'GainzTracker/0.1 (personal macro tracker)'
const KJ_PER_KCAL = 4.184

const numberOrNull = (value: unknown) => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

// OFF returns every value per 100 g. Some products only list kJ, so calories
// fall back to a conversion rather than coming back empty.
// The raw response is untrusted JSON: every field is read defensively.
type Nutriments = Record<string, unknown>

function caloriesPer100g(nutriments: Nutriments) {
  const kcal = numberOrNull(nutriments['energy-kcal_100g'])
  if (kcal != null) return Math.round(kcal)
  const kj = numberOrNull(nutriments['energy_100g'])
  return kj == null ? null : Math.round(kj / KJ_PER_KCAL)
}

// The raw API body -> the small shape the client needs, or null when OFF has no
// such product. A macro the label doesn't list stays null (not 0: "not measured").
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, every field checked below
export function normalizeProduct(barcode: string, body: any) {
  if (body?.status !== 1 || !body.product) return null
  return toProduct(barcode, body.product)
}

// One OFF product record (from a lookup or a search hit) -> our shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, every field checked below
function toProduct(barcode: string, product: any) {
  const nutriments: Nutriments = product.nutriments ?? {}
  // A lookup gives brands as "A, B"; the search service as ["A", "B"].
  const brands: unknown = Array.isArray(product.brands) ? product.brands[0] : product.brands?.split?.(',')[0]

  return {
    barcode,
    name: (typeof product.product_name === 'string' && product.product_name.trim()) || 'Unnamed product',
    brand: (typeof brands === 'string' && brands.trim()) || null,
    servingSize: product.serving_size || null, // the label's own text, e.g. "30 g"
    servingG: numberOrNull(product.serving_quantity),
    per100g: {
      calories: caloriesPer100g(nutriments),
      proteinG: numberOrNull(nutriments['proteins_100g']),
      fatG: numberOrNull(nutriments['fat_100g']),
      carbsG: numberOrNull(nutriments['carbohydrates_100g']),
    },
  }
}

// null = OFF doesn't know this barcode. Throws if OFF itself can't be reached or
// misbehaves, so the caller can tell "no such product" from "try again later".
export async function lookupProduct(barcode: string, fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl(`${BASE_URL}/${barcode}.json?fields=${FIELDS}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`)
  return normalizeProduct(barcode, await res.json())
}

// Search hits -> products. Hits with no calories are dropped: many products on
// OFF have a name but no nutrition table, and those can't fill the form. Asks
// for more than it returns so dropping them still leaves a full list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, every field checked
export function normalizeSearch(body: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
  const hits: any[] = Array.isArray(body?.hits) ? body.hits : []
  return hits
    .filter((hit) => typeof hit?.code === 'string' && /^\d{8,14}$/.test(hit.code))
    .map((hit) => toProduct(hit.code, hit))
    .filter((product) => product.per100g.calories != null && product.per100g.calories > 0)
    .slice(0, SEARCH_RESULTS)
}

// Throws if OFF can't be reached, like lookupProduct; no matches is [].
export async function searchProducts(query: string, fetchImpl: typeof fetch = fetch) {
  const params = new URLSearchParams({ q: query, page_size: '50', fields: `code,${FIELDS}` })
  const res = await fetchImpl(`${SEARCH_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`)
  return normalizeSearch(await res.json())
}
