import { describe, expect, it } from 'vitest'
import { BIG_FOUR_LIFTS } from './lifts'
import { STRENGTH_STANDARDS } from './strength'

describe('BIG_FOUR_LIFTS', () => {
  // The server validates lift-goal names against a hardcoded copy of this list
  // (server/src/routes/lift-goals.js). If they drift, saving a goal for the
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
