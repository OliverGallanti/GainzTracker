// Mifflin-St Jeor — the most widely validated BMR estimate for a general
// (non-athlete) population, hence the default here over Harris-Benedict/Katch-McArdle.
export const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary — little or no exercise', multiplier: 1.2 },
  { key: 'light', label: 'Light — exercise 1-3 days/week', multiplier: 1.375 },
  { key: 'moderate', label: 'Moderate — exercise 3-5 days/week', multiplier: 1.55 },
  { key: 'active', label: 'Active — exercise 6-7 days/week', multiplier: 1.725 },
  { key: 'very_active', label: 'Very active — physical job + training', multiplier: 1.9 },
]

// Null whenever an input is missing, rather than guessing.
export function computeBmr(weightKg, heightCm, age, sex) {
  if (!weightKg || !heightCm || !age || !sex) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

export function computeTdee(bmr, activityLevel) {
  const level = ACTIVITY_LEVELS.find((l) => l.key === activityLevel)
  if (!bmr || !level) return null
  return Math.round(bmr * level.multiplier)
}
