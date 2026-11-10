import { describe, expect, it } from 'vitest'
import { lookupProduct, normalizeProduct, normalizeSearch, searchProducts } from './open-food-facts.ts'

// Shaped like a real response (Nutella, 3017620422003), trimmed to what we read.
const nutella = {
  code: '3017620422003',
  status: 1,
  product: {
    product_name: ' Nutella ',
    brands: 'Ferrero, Nutella',
    serving_size: '15 g',
    serving_quantity: 15,
    nutriments: {
      'energy-kcal_100g': 539,
      'energy_100g': 2252,
      proteins_100g: 6.3,
      fat_100g: 30.9,
      carbohydrates_100g: 57.5,
    },
  },
}

describe('normalizeProduct', () => {
  it('maps a product to name, first brand, serving and per-100g macros', () => {
    expect(normalizeProduct('3017620422003', nutella)).toEqual({
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      servingSize: '15 g',
      servingG: 15,
      per100g: { calories: 539, proteinG: 6.3, fatG: 30.9, carbsG: 57.5 },
    })
  })

  it('returns null when Open Food Facts does not know the barcode', () => {
    expect(normalizeProduct('0', { code: '0', status: 0, status_verbose: 'no code or invalid code' })).toBeNull()
    expect(normalizeProduct('0', { status: 1 })).toBeNull()
    expect(normalizeProduct('0', undefined)).toBeNull()
  })

  it('converts kJ to kcal when only kJ is listed', () => {
    const body = { status: 1, product: { nutriments: { energy_100g: 1000 } } }
    expect(normalizeProduct('1', body).per100g.calories).toBe(239) // 1000 / 4.184
  })

  it('prefers kcal over converting kJ', () => {
    const body = { status: 1, product: { nutriments: { 'energy-kcal_100g': 250, energy_100g: 9999 } } }
    expect(normalizeProduct('1', body).per100g.calories).toBe(250)
  })

  it('keeps a macro the label does not list as null, not 0', () => {
    const body = { status: 1, product: { nutriments: { 'energy-kcal_100g': 100, proteins_100g: 0 } } }
    expect(normalizeProduct('1', body).per100g).toEqual({ calories: 100, proteinG: 0, fatG: null, carbsG: null })
  })

  it('tolerates missing name, brand, serving and nutriments', () => {
    expect(normalizeProduct('1', { status: 1, product: {} })).toEqual({
      barcode: '1',
      name: 'Unnamed product',
      brand: null,
      servingSize: null,
      servingG: null,
      per100g: { calories: null, proteinG: null, fatG: null, carbsG: null },
    })
  })

  it('reads numeric strings, which OFF sometimes returns, and ignores junk', () => {
    const body = { status: 1, product: { serving_quantity: '30', nutriments: { proteins_100g: '12.5', fat_100g: 'n/a' } } }
    const result = normalizeProduct('1', body)
    expect(result.servingG).toBe(30)
    expect(result.per100g.proteinG).toBe(12.5)
    expect(result.per100g.fatG).toBeNull()
  })
})

describe('lookupProduct', () => {
  const respond = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body })

  it('returns the normalized product', async () => {
    expect((await lookupProduct('3017620422003', respond(200, nutella))).name).toBe('Nutella')
  })

  it('returns null for an unknown barcode, whether OFF says 404 or status 0', async () => {
    expect(await lookupProduct('1', respond(404, {}))).toBeNull()
    expect(await lookupProduct('1', respond(200, { status: 0 }))).toBeNull()
  })

  it('throws when Open Food Facts fails, so "not found" and "down" stay distinguishable', async () => {
    await expect(lookupProduct('1', respond(503, {}))).rejects.toThrow('503')
    await expect(lookupProduct('1', async () => { throw new Error('network') })).rejects.toThrow('network')
  })

  it('identifies itself and asks only for the fields it uses', async () => {
    let seen
    await lookupProduct('123', async (url, options) => {
      seen = { url, options }
      return { status: 200, ok: true, json: async () => ({ status: 0 }) }
    })
    expect(seen.url).toContain('/123.json?fields=')
    expect(seen.options.headers['User-Agent']).toMatch(/GainzTracker/)
  })
})

describe('normalizeSearch', () => {
  // Shaped like search.openfoodfacts.org hits: brands come as an array there.
  const hit = (code, name, kcal, brands) => ({ code, product_name: name, brands, nutriments: kcal == null ? {} : { 'energy-kcal_100g': kcal, proteins_100g: 1.4 } })

  it('maps hits to products, first brand from the array', () => {
    const [banana] = normalizeSearch({ hits: [hit('2602605002502', 'Plátano de Canarias', 93, ['Masymas', 'Other'])] })
    expect(banana).toMatchObject({ barcode: '2602605002502', name: 'Plátano de Canarias', brand: 'Masymas', per100g: { calories: 93, proteinG: 1.4 } })
  })

  it('drops hits with no calories or no usable barcode, and keeps at most 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => hit(String(10000000 + i), `Food ${i}`, 50))
    expect(normalizeSearch({ hits: [hit('12345678', 'No table', null), hit('12345679', 'Zero', 0), hit('abc', 'Bad code', 50)] })).toEqual([])
    expect(normalizeSearch({ hits: many })).toHaveLength(10)
  })

  it('tolerates a body with no hits', () => {
    expect(normalizeSearch(undefined)).toEqual([])
    expect(normalizeSearch({ hits: 'nope' })).toEqual([])
  })
})

describe('searchProducts', () => {
  it('sends the query encoded, identifies itself, and throws when OFF fails', async () => {
    let seen
    await searchProducts('plátano canario', async (url, options) => {
      seen = { url, options }
      return { ok: true, json: async () => ({ hits: [] }) }
    })
    expect(new URL(seen.url).searchParams.get('q')).toBe('plátano canario')
    expect(seen.options.headers['User-Agent']).toMatch(/GainzTracker/)
    await expect(searchProducts('x', async () => ({ ok: false, status: 503 }))).rejects.toThrow('503')
  })
})
