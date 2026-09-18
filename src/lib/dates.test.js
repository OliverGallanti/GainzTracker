import { describe, expect, it } from 'vitest'
import { startOfLocalDay } from './dates'

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
