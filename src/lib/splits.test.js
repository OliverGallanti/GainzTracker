import { describe, expect, it } from 'vitest'
import { computeAdherenceStreak, suggestedDayIndex, uniqueDays } from './splits'

// The API returns logs newest-first, which is what these helpers assume.
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

describe('suggestedDayIndex', () => {
  const days = ['Push', 'Pull', 'Legs']

  it('starts at the first day when nothing is logged', () => {
    expect(suggestedDayIndex(days, [])).toBe(0)
  })

  it('suggests the day after the most recent log, whatever the log order was', () => {
    expect(suggestedDayIndex(days, [{ dayIndex: 0 }])).toBe(1)
    expect(suggestedDayIndex(days, [{ dayIndex: 2 }, { dayIndex: 0 }])).toBe(0) // wraps
    expect(suggestedDayIndex(days, [{ dayIndex: 0 }, { dayIndex: 2 }])).toBe(1) // picked out of order
  })

  it('handles a single-day split', () => {
    expect(suggestedDayIndex(['Full body'], [{ dayIndex: 0 }])).toBe(0)
  })
})

describe('uniqueDays', () => {
  it('lists each label once, at its first index', () => {
    expect(uniqueDays(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'])).toEqual([
      { label: 'Push', index: 0 },
      { label: 'Pull', index: 1 },
      { label: 'Legs', index: 2 },
    ])
  })

  it('keeps a split with no repeats as is', () => {
    expect(uniqueDays(['A', 'B'])).toEqual([
      { label: 'A', index: 0 },
      { label: 'B', index: 1 },
    ])
  })
})
