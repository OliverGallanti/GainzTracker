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
