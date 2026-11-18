import { describe, expect, it } from 'vitest'
import { addDays, buildMonthGrid, dayLabel, dayRange, loggedAtOn, startOfLocalDay, startOfLocalWeek } from './dates'

describe('buildMonthGrid', () => {
  it('pads to the weekday of the 1st and has every day of the month', () => {
    const cells = buildMonthGrid(new Date(2026, 1, 15)) // Feb 2026: starts on a Sunday, 28 days
    expect(cells).toHaveLength(28)
    expect(cells[0]?.getDate()).toBe(1)

    const sept = buildMonthGrid(new Date(2026, 8, 1)) // Sep 2026: starts on a Tuesday, 30 days
    expect(sept.slice(0, 2)).toEqual([null, null])
    expect(sept[2]?.getDate()).toBe(1)
    expect(sept).toHaveLength(32)
  })
})

describe('startOfLocalDay', () => {
  it('zeroes the time while keeping the calendar date', () => {
    const start = startOfLocalDay(new Date(2026, 8, 18, 14, 37, 12, 500))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(8)
    expect(start.getDate()).toBe(18)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
  })

  it('does not mutate the date it was given', () => {
    const original = new Date(2026, 8, 18, 14, 37)
    const copy = new Date(original)
    startOfLocalDay(original)
    expect(original.getTime()).toBe(copy.getTime())
  })

  it('is already midnight for a date at midnight', () => {
    const midnight = new Date(2026, 8, 18, 0, 0, 0, 0)
    expect(startOfLocalDay(midnight).getTime()).toBe(midnight.getTime())
  })

  it('defaults to today', () => {
    const start = startOfLocalDay()
    const today = new Date()
    expect(start.getDate()).toBe(today.getDate())
    expect(start.getHours()).toBe(0)
  })
})

describe('startOfLocalWeek', () => {
  it('is the Monday of the same week, at midnight', () => {
    // Wed 16 Sep 2026 -> Mon 14 Sep 2026
    const start = startOfLocalWeek(new Date(2026, 8, 16, 15, 30))
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 8, 14, 0])
  })

  it('treats Monday as the first day and Sunday as the last', () => {
    expect(startOfLocalWeek(new Date(2026, 8, 14, 0, 0)).getDate()).toBe(14) // Monday itself
    expect(startOfLocalWeek(new Date(2026, 8, 20, 23, 59)).getDate()).toBe(14) // Sunday belongs to that week
    expect(startOfLocalWeek(new Date(2026, 8, 21, 0, 1)).getDate()).toBe(21) // next Monday starts a new one
  })

  it('crosses month and year boundaries', () => {
    const start = startOfLocalWeek(new Date(2026, 0, 1)) // Thu 1 Jan 2026 -> Mon 29 Dec 2025
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2025, 11, 29])
  })

  it('does not mutate its argument', () => {
    const original = new Date(2026, 8, 16, 12)
    const copy = new Date(original)
    startOfLocalWeek(original)
    expect(original.getTime()).toBe(copy.getTime())
  })
})

describe('day history helpers', () => {
  it('moves by calendar days and gives the whole local day as a range', () => {
    expect(addDays(new Date(2026, 10, 1), -1).getDate()).toBe(31)
    const { since, until } = dayRange(new Date(2026, 10, 16, 15, 30))
    expect(new Date(since)).toEqual(new Date(2026, 10, 16))
    expect(new Date(until)).toEqual(new Date(2026, 10, 16, 23, 59, 59, 999))
  })

  it('logs a past day at midday and today at now', () => {
    const now = new Date(2026, 10, 18, 9, 15)
    expect(loggedAtOn(new Date(2026, 10, 18), now)).toBe(now.toISOString())
    expect(new Date(loggedAtOn(new Date(2026, 10, 16), now))).toEqual(new Date(2026, 10, 16, 12))
  })

  it('names today and yesterday', () => {
    const today = new Date(2026, 10, 18, 9)
    expect(dayLabel(new Date(2026, 10, 18), today)).toBe('Today')
    expect(dayLabel(new Date(2026, 10, 17), today)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 10, 16), today)).not.toMatch(/day$/)
  })
})
