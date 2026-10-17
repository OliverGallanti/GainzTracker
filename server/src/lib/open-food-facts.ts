// Open Food Facts (https://world.openfoodfacts.org) — a free, open, crowd-sourced
// product database, no API key. Their terms ask for an identifying User-Agent, and
// the data is ODbL-licensed: credit it wherever it's shown.
const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'
const FIELDS = 'product_name,brands,serving_size,serving_quantity,nutriments'
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

  const { product } = body
  const nutriments: Nutriments = product.nutriments ?? {}

  return {
    barcode,
    name: product.product_name?.trim() || 'Unnamed product',
    brand: product.brands?.split(',')[0]?.trim() || null,
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
