import type { Macros, Meal } from './types'

type Totals = { calories: number; proteinG: number; fatG: number; carbsG: number }

// Totals for the day's logged meals. Calories are always present; the three
// macros are optional per meal, so a missing one contributes 0 to the total
// rather than making the whole total null.
export function sumToday(meals: Macros[]): Totals {
  return meals.reduce<Totals>(
    (totals, meal) => ({
      calories: totals.calories + meal.calories,
      proteinG: totals.proteinG + (meal.proteinG ?? 0),
      fatG: totals.fatG + (meal.fatG ?? 0),
      carbsG: totals.carbsG + (meal.carbsG ?? 0),
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  )
}

// null when a meal didn't log that macro, rather than "0g" implying it was measured.
export function formatMacro(value: number | null | undefined, unit: string) {
  return value == null ? null : `${Math.round(value)}${unit}`
}

export const OTHER_MEAL = 'Other'

export interface MealGroup {
  name: string
  entries: Meal[]
  totals: Totals
}

// Today's meals grouped under the user's meal slots, in slot order, each with its
// own totals. An empty slot is kept (so it can offer "add"); "Other" collects
// meals with no slot or a slot since renamed away, and only exists if non-empty.
export function groupByMeal(meals: Meal[], mealNames: string[]): MealGroup[] {
  const groups = mealNames.map((name) => ({ name, entries: [] as Meal[] }))
  const other = { name: OTHER_MEAL, entries: [] as Meal[] }
  for (const meal of meals) {
    const group = groups.find((g) => g.name === meal.mealName)
    ;(group ?? other).entries.push(meal)
  }
  if (other.entries.length) groups.push(other)
  return groups.map((g) => ({ ...g, totals: sumToday(g.entries) }))
}

// Anything with per-serving (or per-100 g) values; calories may be missing on
// a scanned product.
type Scalable = { calories: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null }

// A saved food holds one serving; logging N servings multiplies it. (A scanned
// product is the same thing per 100 g, with grams / 100 as the multiplier.) Values
// stay null when the food never had them, and are rounded: calories to whole,
// macros to a tenth of a gram.
const round1 = (n: number) => Math.round(n * 10) / 10
export function scaleFood(food: Scalable, servings: number): Scalable {
  const scale = (value: number | null) => (value == null ? null : round1(value * servings))
  return {
    calories: food.calories == null ? null : Math.round(food.calories * servings),
    proteinG: scale(food.proteinG),
    fatG: scale(food.fatG),
    carbsG: scale(food.carbsG),
  }
}
