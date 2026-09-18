import { describe, expect, it } from 'vitest'
import { formatMacro, sumToday } from './macros'

describe('sumToday', () => {
  it('adds up every logged macro and the calories', () => {
    expect(
      sumToday([
        { calories: 600, proteinG: 50, fatG: 10, carbsG: 70 },
        { calories: 220, proteinG: 40, fatG: 5, carbsG: 10 },
      ]),
    ).toEqual({ calories: 820, proteinG: 90, fatG: 15, carbsG: 80 })
  })

  it('counts a missing macro as zero without nulling the whole total', () => {
    // A shake logged with only protein must still contribute its calories.
    expect(sumToday([{ calories: 220, proteinG: 40 }])).toEqual({
      calories: 220,
      proteinG: 40,
      fatG: 0,
      carbsG: 0,
    })
  })

  it('returns zeroes for an empty day', () => {
    expect(sumToday([])).toEqual({ calories: 0, proteinG: 0, fatG: 0, carbsG: 0 })
  })
})

describe('formatMacro', () => {
  it('appends the unit and rounds', () => {
    expect(formatMacro(49.6, 'g P')).toBe('50g P')
  })

  it('returns null for an unlogged macro, so the UI can omit it entirely', () => {
    // Distinct from 0 — "not measured" must not render as "0g".
    expect(formatMacro(null, 'g P')).toBeNull()
    expect(formatMacro(undefined, 'g P')).toBeNull()
  })

  it('still formats a real zero', () => {
    expect(formatMacro(0, 'g F')).toBe('0g F')
  })
})
