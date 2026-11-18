// Bodyweight-ratio strength standards for the Big 4 lifts. Each threshold is
// where that tier begins (ratio = lift / bodyweight); below the first
// threshold is Beginner. Source: user-supplied standard, not derived.
import type { Sex } from './types.ts'

export const STRENGTH_STANDARDS: Record<Sex, Record<string, number[]>> = {
  male: {
    Squat: [1.0, 1.5, 2.0, 2.5],
    Deadlift: [1.2, 1.75, 2.5, 3.0],
    'Bench Press': [0.8, 1.2, 1.5, 2.0],
    'Overhead Press': [0.5, 0.75, 1.0, 1.25],
  },
  female: {
    Squat: [0.6, 1.0, 1.4, 1.8],
    Deadlift: [0.8, 1.25, 1.8, 2.2],
    'Bench Press': [0.4, 0.7, 1.0, 1.2],
    'Overhead Press': [0.25, 0.4, 0.6, 0.8],
  },
}

export const STRENGTH_TIERS = [
  { label: 'Beginner', icon: '🌱' },
  { label: 'Novice', icon: '🔸' },
  { label: 'Intermediate', icon: '⭐' },
  { label: 'Advanced', icon: '🔥' },
  { label: 'Elite / Pro', icon: '🏆' },
]

// Null whenever an input is missing, rather than guessing — bodyweight, sex,
// and a logged lift are all required for the ratio to mean anything.
export function getStrengthTier(
  exerciseName: string,
  liftKg: number | null | undefined,
  bodyweightKg: number | null | undefined,
  sex: Sex | null | undefined,
) {
  const thresholds = sex && STRENGTH_STANDARDS[sex]?.[exerciseName]
  if (!thresholds || !liftKg || !bodyweightKg) return null
  const ratio = liftKg / bodyweightKg
  return STRENGTH_TIERS[thresholds.filter((t) => ratio >= t).length]
}

// The same thresholds, converted to this person's kg at their current
// bodyweight, for drawing as reference lines on a lift's progression chart —
// "here's what Novice/Intermediate/Advanced/Elite look like for you."
// Beginner has no threshold of its own (it's "below Novice"), so only the
// four real boundaries get a line.
export function getStrengthReferenceLines(
  exerciseName: string,
  bodyweightKg: number | null | undefined,
  sex: Sex | null | undefined,
) {
  const thresholds = sex && STRENGTH_STANDARDS[sex]?.[exerciseName]
  if (!thresholds || !bodyweightKg) return []
  return thresholds.map((ratio, i) => ({
    label: STRENGTH_TIERS[i + 1].label,
    value: Math.round(ratio * bodyweightKg * 10) / 10,
  }))
}
