import { describe, expect, it } from 'vitest'
import { calorieFloor, suggestMacros, tdeePresets } from './macroSplit'

const kcal = ({ proteinG, fatG, carbsG }) => proteinG * 4 + fatG * 9 + carbsG * 4

describe('suggestMacros', () => {
  it('maintain: 1.8 g/kg protein, 25% of calories as fat, carbs fill the rest', () => {
    const result = suggestMacros({ calories: 2400, weightKg: 80, goal: 'maintain' })
    expect(result.proteinG).toBe(144) // 80 * 1.8
    expect(result.fatG).toBe(67) // 600 kcal / 9
    expect(result.carbsG).toBe(305)
    expect(Math.abs(kcal(result) - 2400)).toBeLessThanOrEqual(4) // rounding only
  })

  it('cut uses more protein per kg than maintain', () => {
    const cut = suggestMacros({ calories: 1900, weightKg: 80, goal: 'cut' })
    expect(cut.proteinG).toBe(160) // 80 * 2.0
    expect(cut.proteinG).toBeGreaterThan(suggestMacros({ calories: 1900, weightKg: 80, goal: 'maintain' }).proteinG)
  })

  it('defaults to maintain and treats an unknown goal as maintain', () => {
    const base = suggestMacros({ calories: 2000, weightKg: 70 })
    expect(suggestMacros({ calories: 2000, weightKg: 70, goal: 'bulk' }).proteinG).toBe(base.proteinG)
    expect(suggestMacros({ calories: 2000, weightKg: 70, goal: 'nonsense' }).proteinG).toBe(base.proteinG)
  })

  it('keeps fat above a per-kg floor when calories are low', () => {
    // 25% of 1500 kcal is 42 g, but 90 kg * 0.6 = 54 g
    expect(suggestMacros({ calories: 1500, weightKg: 90 }).fatG).toBe(54)
  })

  it('never overshoots a target too low to cover protein + minimum fat', () => {
    const result = suggestMacros({ calories: 1300, weightKg: 120 })
    expect(result.carbsG).toBe(0)
    expect(result.fatG).toBe(72) // 120 * 0.6, kept
    expect(result.proteinG).toBeLessThan(120 * 1.8) // gave way
    expect(kcal(result)).toBeLessThanOrEqual(1300)
  })

  it('is null when it cannot be worked out', () => {
    expect(suggestMacros({ calories: 0, weightKg: 80 })).toBeNull()
    expect(suggestMacros({ calories: NaN, weightKg: 80 })).toBeNull()
    expect(suggestMacros({ calories: 2000, weightKg: null })).toBeNull()
  })
})

describe('tdeePresets', () => {
  const byKey = (presets) => Object.fromEntries(presets.map((p) => [p.key, p]))

  it('offers cut -500, maintain, bulk +300', () => {
    const p = byKey(tdeePresets(2400, 'male', 30))
    expect([p.cut.calories, p.maintain.calories, p.bulk.calories]).toEqual([1900, 2400, 2700])
    expect(p.cut.available).toBe(true)
  })

  it('will not cut below the calorie floor for the sex', () => {
    expect(byKey(tdeePresets(1500, 'female', 30)).cut.calories).toBe(1200) // 1000 would be too low
    expect(byKey(tdeePresets(1900, 'male', 30)).cut.calories).toBe(1500) // 1400 clamped up
  })

  it('marks cut unavailable when maintenance is already at the floor', () => {
    expect(byKey(tdeePresets(1200, 'female', 30)).cut.available).toBe(false)
    expect(byKey(tdeePresets(1500, 'male', 30)).cut.available).toBe(false)
  })

  it('gives under-18s maintenance only', () => {
    expect(tdeePresets(2400, 'male', 16).map((p) => p.key)).toEqual(['maintain'])
    expect(tdeePresets(2400, 'male', 18).map((p) => p.key)).toEqual(['cut', 'maintain', 'bulk'])
  })

  it('an unknown age is treated as an adult; an unknown sex uses the stricter floor', () => {
    expect(tdeePresets(2400, 'male', null)).toHaveLength(3)
    expect(calorieFloor(null)).toBe(1500)
  })
})
