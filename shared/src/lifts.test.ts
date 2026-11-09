import { describe, expect, it } from 'vitest'
import { BIG_FOUR_LIFTS, formatEffort, RPE_VALUES } from './lifts'
import { STRENGTH_STANDARDS } from './strength'

describe('RPE', () => {
  it('shows reps in reserve as the same scale read the other way', () => {
    expect(formatEffort(8)).toBe('RPE 8 · RIR 2')
    expect(formatEffort(6.5)).toBe('RPE 6.5 · RIR 3.5')
    expect(formatEffort(10)).toBe('RPE 10 · RIR 0')
  })

  // The server accepts 6 to 10 in half steps (server/src/routes/workouts.ts).
  it('offers exactly what the API accepts', () => {
    expect(RPE_VALUES).toEqual([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10])
  })
})

describe('BIG_FOUR_LIFTS', () => {
  // The server validates lift-goal names against a hardcoded copy of this list
  // (server/src/routes/lift-goals.ts). If they drift, saving a goal for the
  // missing lift silently 400s. This pins the exact names and order.
  it('matches the names the API accepts', () => {
    expect(BIG_FOUR_LIFTS).toEqual(['Deadlift', 'Squat', 'Bench Press', 'Overhead Press'])
  })

  // Strength tiers are looked up by these same names; a lift missing from the
  // standards table would silently show no rating.
  it('has strength standards for every lift, for both sexes', () => {
    for (const sex of Object.keys(STRENGTH_STANDARDS)) {
      for (const lift of BIG_FOUR_LIFTS) {
        expect(STRENGTH_STANDARDS[sex][lift], `${sex}/${lift}`).toHaveLength(4)
      }
    }
  })

  it('has no duplicates', () => {
    expect(new Set(BIG_FOUR_LIFTS).size).toBe(BIG_FOUR_LIFTS.length)
  })
})
