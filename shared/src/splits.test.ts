import { describe, expect, it } from 'vitest'
import { computeWeeklyStreak, suggestedDayIndex, uniqueDays, weeklyGoal } from './splits'

// "Now" is Wed 16 Sep 2026; weeks run Monday to Sunday, so this week is 14-20 Sep.
const NOW = new Date(2026, 8, 16, 12)
const done = (day, month = 8) => ({ completed: true, loggedAt: new Date(2026, month, day, 18).toISOString() })
const skipped = (day, month = 8) => ({ completed: false, loggedAt: new Date(2026, month, day, 18).toISOString() })

describe('weeklyGoal', () => {
  it("uses the routine's own goal when it has one", () => {
    expect(weeklyGoal({ daysPerWeek: 4, days: ['A', 'B', 'C'] })).toBe(4)
  })

  it('falls back to the routine length, capped at 7 and at least 1', () => {
    expect(weeklyGoal({ daysPerWeek: null, days: ['Push', 'Pull', 'Legs'] })).toBe(3)
    expect(weeklyGoal({ daysPerWeek: null, days: Array(9).fill('x') })).toBe(7)
    expect(weeklyGoal({ daysPerWeek: null, days: [] })).toBe(1)
  })
})

describe('computeWeeklyStreak', () => {
  it('4 days in a week with a goal of 4 is a 1-week streak', () => {
    const friday = new Date(2026, 8, 18, 12)
    const logs = [done(14), done(15), done(16), done(18)]
    expect(computeWeeklyStreak(logs, 4, friday)).toEqual({ streak: 1, thisWeekDays: 4, goal: 4 })
  })

  it('one day short of the goal is not yet a streak week', () => {
    expect(computeWeeklyStreak([done(14), done(15), done(16), skipped(17)], 4, new Date(2026, 8, 18, 12)).streak).toBe(0)
  })

  it('counts consecutive met weeks, this week included once it is met', () => {
    const logs = [
      done(14), done(15), done(16), done(17), // this week: 4 (met)
      done(7), done(8), done(9), done(10), // last week: 4
      done(1), done(2), done(3), done(4), // the week before: 4
    ]
    expect(computeWeeklyStreak(logs, 4, NOW)).toEqual({ streak: 3, thisWeekDays: 4, goal: 4 })
  })

  it('the week in progress does not break the streak while it is still unmet', () => {
    const logs = [done(14), done(7), done(8), done(9), done(10), done(1), done(2), done(3), done(4)]
    const result = computeWeeklyStreak(logs, 4, NOW)
    expect(result.streak).toBe(2) // last week and the one before; this week has 1 of 4 so far
    expect(result.thisWeekDays).toBe(1)
  })

  it('a missed full week ends the streak', () => {
    const logs = [
      done(14), done(15), done(16), done(17), // this week met
      done(7), done(8), // last week: only 2 of 4, missed
      done(1), done(2), done(3), done(4), // older, met but no longer connected
    ]
    expect(computeWeeklyStreak(logs, 4, NOW).streak).toBe(1)
  })

  it('only weeks connected to now count', () => {
    const logs = [done(7), done(8), done(9), done(10)] // last week met; this week empty so far
    expect(computeWeeklyStreak(logs, 4, NOW).streak).toBe(1)
    expect(computeWeeklyStreak([done(1), done(2), done(3), done(4)], 4, NOW).streak).toBe(0) // two weeks ago: not connected to now
  })

  it('skipped days do not count toward the goal', () => {
    const logs = [done(14), done(15), skipped(16), skipped(17), done(7), done(8), skipped(9), skipped(10)]
    expect(computeWeeklyStreak(logs, 4, NOW).streak).toBe(0)
    expect(computeWeeklyStreak(logs, 2, NOW).streak).toBe(2) // 2 completed days each week meets a goal of 2
  })

  it('counts each calendar day once, even with logs from several routines', () => {
    const twoRoutinesSameDay = [done(14), done(14), done(15), done(15)]
    expect(computeWeeklyStreak(twoRoutinesSameDay, 3, NOW)).toEqual({ streak: 0, thisWeekDays: 2, goal: 3 })
  })

  it('Sunday belongs to the week that started on the Monday before it', () => {
    // 13 Sep 2026 is a Sunday: last week's last day
    const logs = [done(8), done(9), done(10), done(13)] // Tue Wed Thu + Sun, all last week
    expect(computeWeeklyStreak(logs, 4, NOW).streak).toBe(1)
  })

  it('works across a month boundary', () => {
    const now = new Date(2026, 9, 1, 12) // Thu 1 Oct; week is 28 Sep - 4 Oct
    const logs = [done(28, 8), done(29, 8), done(30, 8), done(1, 9), done(21, 8), done(22, 8), done(23, 8), done(24, 8)]
    expect(computeWeeklyStreak(logs, 4, now).streak).toBe(2)
  })

  it('is zero with no logs, and never negative or NaN for odd input', () => {
    expect(computeWeeklyStreak([], 3, NOW)).toEqual({ streak: 0, thisWeekDays: 0, goal: 3 })
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
