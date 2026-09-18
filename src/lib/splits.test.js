import { describe, expect, it } from 'vitest'
import { computeAdherenceStreak, nextDayIndex } from './splits'

// The API returns logs newest-first, which is what both helpers assume.
const log = (completed) => ({ completed })

describe('computeAdherenceStreak', () => {
  it('counts consecutive completed days from the most recent backwards', () => {
    expect(computeAdherenceStreak([log(true), log(true), log(true)])).toBe(3)
  })

  it('stops at the first skipped day', () => {
    // Newest-first: done, done, skipped, done → only the two most recent count.
    expect(computeAdherenceStreak([log(true), log(true), log(false), log(true)])).toBe(2)
  })

  it('is zero when the most recent day was skipped, however long the run behind it', () => {
    expect(computeAdherenceStreak([log(false), log(true), log(true), log(true)])).toBe(0)
  })

  it('is zero with no logs at all', () => {
    expect(computeAdherenceStreak([])).toBe(0)
  })
})

describe('nextDayIndex', () => {
  const days = ['Push', 'Pull', 'Legs']

  it('starts at the first day when nothing is logged', () => {
    expect(nextDayIndex(days, [])).toBe(0)
  })

  it('advances one slot per log', () => {
    expect(nextDayIndex(days, [log(true)])).toBe(1)
    expect(nextDayIndex(days, [log(true), log(true)])).toBe(2)
  })

  it('wraps back to the start after a full cycle', () => {
    expect(nextDayIndex(days, [log(true), log(true), log(true)])).toBe(0)
    expect(nextDayIndex(days, Array(7).fill(log(true)))).toBe(1)
  })

  it('advances on skipped days too, so a dreaded day cannot be dodged', () => {
    expect(nextDayIndex(days, [log(false)])).toBe(1)
    expect(nextDayIndex(days, [log(false), log(false)])).toBe(2)
  })

  it('handles a single-day split', () => {
    expect(nextDayIndex(['Full body'], [log(true), log(true)])).toBe(0)
  })
})
