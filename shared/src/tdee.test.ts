import { describe, expect, it } from 'vitest'
import { ACTIVITY_LEVELS, computeBmr, computeTdee } from './tdee'

describe('computeBmr', () => {
  // Mifflin-St Jeor: 10*kg + 6.25*cm - 5*age, +5 male / -161 female.
  it('matches the formula for men', () => {
    // 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5
    expect(computeBmr(80, 180, 25, 'male')).toBe(1805)
  })

  it('matches the formula for women', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161
    expect(computeBmr(65, 165, 30, 'female')).toBe(1370)
  })

  it('applies the 166-point male/female offset at otherwise identical inputs', () => {
    expect(computeBmr(80, 180, 25, 'male') - computeBmr(80, 180, 25, 'female')).toBe(166)
  })

  it('decreases with age', () => {
    expect(computeBmr(80, 180, 40, 'male')).toBeLessThan(computeBmr(80, 180, 25, 'male'))
  })

  it('returns null rather than guessing when an input is missing', () => {
    expect(computeBmr(null, 180, 25, 'male')).toBeNull()
    expect(computeBmr(80, null, 25, 'male')).toBeNull()
    expect(computeBmr(80, 180, null, 'male')).toBeNull()
    expect(computeBmr(80, 180, 25, null)).toBeNull()
  })
})

describe('computeTdee', () => {
  it('scales BMR by the activity multiplier', () => {
    expect(computeTdee(1805, 'moderate')).toBe(Math.round(1805 * 1.55))
  })

  it('returns a higher number for every step up in activity', () => {
    const values = ACTIVITY_LEVELS.map((l) => computeTdee(1805, l.key))
    const ascending = [...values].sort((a, b) => a - b)
    expect(values).toEqual(ascending)
    expect(new Set(values).size).toBe(values.length)
  })

  it('returns null for a missing BMR or an unknown activity level', () => {
    expect(computeTdee(null, 'moderate')).toBeNull()
    expect(computeTdee(1805, 'unknown_key')).toBeNull()
    expect(computeTdee(1805, null)).toBeNull()
  })
})

describe('ACTIVITY_LEVELS', () => {
  // The server validates activityLevel against a hardcoded copy of these keys
  // (server/src/routes/me.ts). If they ever drift, saving silently 400s.
  it('uses the keys the API accepts', () => {
    expect(ACTIVITY_LEVELS.map((l) => l.key)).toEqual([
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active',
    ])
  })
})
