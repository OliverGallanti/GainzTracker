// Totals for the day's logged meals. Calories are always present; the three
// macros are optional per meal, so a missing one contributes 0 to the total
// rather than making the whole total null.
export function sumToday(meals) {
  return meals.reduce(
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
export function formatMacro(value, unit) {
  return value == null ? null : `${Math.round(value)}${unit}`
}

export const OTHER_MEAL = 'Other'

// Today's meals grouped under the user's meal slots, in slot order, each with its
// own totals. An empty slot is kept (so it can offer "add"); "Other" collects
// meals with no slot or a slot since renamed away, and only exists if non-empty.
export function groupByMeal(meals, mealNames) {
  const groups = mealNames.map((name) => ({ name, entries: [] }))
  const other = { name: OTHER_MEAL, entries: [] }
  for (const meal of meals) {
    const group = groups.find((g) => g.name === meal.mealName)
    ;(group ?? other).entries.push(meal)
  }
  if (other.entries.length) groups.push(other)
  return groups.map((g) => ({ ...g, totals: sumToday(g.entries) }))
}

// A saved food holds one serving; logging N servings multiplies it. (A scanned
// product is the same thing per 100 g, with grams / 100 as the multiplier.) Values
// stay null when the food never had them, and are rounded: calories to whole,
// macros to a tenth of a gram.
const round1 = (n) => Math.round(n * 10) / 10
export function scaleFood(food, servings) {
  const scale = (value) => (value == null ? null : round1(value * servings))
  return {
    calories: food.calories == null ? null : Math.round(food.calories * servings),
    proteinG: scale(food.proteinG),
    fatG: scale(food.fatG),
    carbsG: scale(food.carbsG),
  }
}
