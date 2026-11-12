import { describe, expect, it } from 'vitest'
import { amountFactor, basisLabel, foodUnits, formatAmount, formatMacro, groupByMeal, scaleFood, sumToday } from './macros'
import type { Macros, Meal } from './types'

describe('sumToday', () => {
  it('adds up every logged macro and the calories', () => {
    expect(
      sumToday([
        { calories: 600, proteinG: 50, fatG: 10, carbsG: 70 },
        { calories: 220, proteinG: 40, fatG: 5, carbsG: 10 },
      ]),
    ).toEqual({ calories: 820, proteinG: 90, fatG: 15, carbsG: 80 })
  })

  it('counts a missing macro as zero without nulling the whole total', () => {
    // A shake logged with only protein must still contribute its calories.
    expect(sumToday([{ calories: 220, proteinG: 40 } as Macros])).toEqual({
      calories: 220,
      proteinG: 40,
      fatG: 0,
      carbsG: 0,
    })
  })

  it('returns zeroes for an empty day', () => {
    expect(sumToday([])).toEqual({ calories: 0, proteinG: 0, fatG: 0, carbsG: 0 })
  })
})

describe('formatMacro', () => {
  it('appends the unit and rounds', () => {
    expect(formatMacro(49.6, 'g P')).toBe('50g P')
  })

  it('returns null for an unlogged macro, so the UI can omit it entirely', () => {
    // Distinct from 0 — "not measured" must not render as "0g".
    expect(formatMacro(null, 'g P')).toBeNull()
    expect(formatMacro(undefined, 'g P')).toBeNull()
  })

  it('still formats a real zero', () => {
    expect(formatMacro(0, 'g F')).toBe('0g F')
  })
})

describe('groupByMeal', () => {
  // Only the fields grouping reads.
  const meal = (mealName: string | null, calories: number) => ({ mealName, calories }) as Meal
  const slots = ['Breakfast', 'Lunch', 'Dinner']

  it('groups under each slot in slot order, with per-slot totals', () => {
    const groups = groupByMeal([meal('Lunch', 500), meal('Breakfast', 300), meal('Lunch', 100)], slots)
    expect(groups.map((g) => g.name)).toEqual(['Breakfast', 'Lunch', 'Dinner'])
    expect(groups.map((g) => g.totals.calories)).toEqual([300, 600, 0])
    expect(groups[1].entries).toHaveLength(2)
  })

  it('keeps empty slots so they can offer "add"', () => {
    expect(groupByMeal([], slots).map((g) => g.entries.length)).toEqual([0, 0, 0])
  })

  it('puts meals with no slot, or a slot that no longer exists, under Other', () => {
    const groups = groupByMeal([meal(null, 100), meal('Brunch', 200), meal('Dinner', 50)], slots)
    expect(groups.at(-1).name).toBe('Other')
    expect(groups.at(-1).totals.calories).toBe(300)
    expect(groups[2].totals.calories).toBe(50)
  })

  it('has no Other group when everything fits a slot', () => {
    expect(groupByMeal([meal('Lunch', 1)], slots).some((g) => g.name === 'Other')).toBe(false)
  })
})

describe('scaleFood', () => {
  const chili = { calories: 400, proteinG: 30, fatG: 12.5, carbsG: null }

  it('multiplies one serving', () => {
    expect(scaleFood(chili, 2)).toEqual({ calories: 800, proteinG: 60, fatG: 25, carbsG: null })
  })

  it('handles fractional servings, rounding calories to whole and macros to a tenth', () => {
    expect(scaleFood({ calories: 333, proteinG: 10.3, fatG: 1, carbsG: 7 }, 1.5)).toEqual({
      calories: 500, // 499.5 rounds up
      proteinG: 15.5,
      fatG: 1.5,
      carbsG: 10.5,
    })
  })

  it('keeps a macro the food never had as null, not 0', () => {
    expect(scaleFood(chili, 3).carbsG).toBeNull()
  })

  it('keeps missing calories null too, as a product with no energy listed has', () => {
    expect(scaleFood({ calories: null, proteinG: 10, fatG: null, carbsG: null }, 2).calories).toBeNull()
  })

  it('scales a per-100g product to the grams eaten', () => {
    const per100g = { calories: 539, proteinG: 6.3, fatG: 30.9, carbsG: 57.5 }
    expect(scaleFood(per100g, 15 / 100)).toEqual({ calories: 81, proteinG: 0.9, fatG: 4.6, carbsG: 8.6 })
  })
})

describe('food amounts', () => {
  const per100 = { basis: '100g' as const, servingG: null }
  const labelled = { basis: '100g' as const, servingG: 30 }
  const serving = { basis: 'serving' as const, servingG: null }
  const bar = { basis: 'serving' as const, servingG: 60 }

  it('offers grams or servings only when the weight of a serving is known', () => {
    expect(foodUnits(per100)).toEqual(['g'])
    expect(foodUnits(labelled)).toEqual(['g', 'serving'])
    expect(foodUnits(serving)).toEqual(['serving'])
    expect(foodUnits(bar)).toEqual(['serving', 'g'])
  })

  it('turns an amount into a multiplier of the food values', () => {
    expect(amountFactor(per100, 120, 'g')).toBe(1.2)
    expect(amountFactor(labelled, 2, 'serving')).toBe(0.6) // 2 × 30 g of a per-100 g food
    expect(amountFactor(serving, 1.5, 'serving')).toBe(1.5)
    expect(amountFactor(bar, 90, 'g')).toBe(1.5)
  })

  it('labels the basis and the amount', () => {
    expect(basisLabel(per100)).toBe('per 100 g')
    expect(basisLabel(bar)).toBe('per serving (60 g)')
    expect(basisLabel(serving)).toBe('per serving')
    expect(formatAmount(120, 'g')).toBe('120 g')
    expect(formatAmount(1, 'serving')).toBe('1 serving')
    expect(formatAmount(2.5, 'serving')).toBe('2.5 servings')
  })
})
