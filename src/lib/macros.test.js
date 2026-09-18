import { describe, expect, it } from 'vitest'
import { formatMacro, groupByMeal, scaleFood, sumToday } from './macros'

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
    expect(sumToday([{ calories: 220, proteinG: 40 }])).toEqual({
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
  const meal = (mealName, calories) => ({ mealName, calories })
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
})
