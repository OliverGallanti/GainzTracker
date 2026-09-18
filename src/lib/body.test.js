import { describe, expect, it } from 'vitest'
import { computeBmi } from './body'

describe('computeBmi', () => {
  it('computes weight over height-in-metres squared', () => {
    // 80 / 1.8^2 = 24.691...
    expect(computeBmi(80, 180)).toBeCloseTo(24.69, 2)
  })

  it('treats height as centimetres, not metres', () => {
    // The /100 conversion is the easiest thing to drop in a refactor; without
    // it this would be a nonsense 0.0025.
    expect(computeBmi(80, 180)).toBeGreaterThan(10)
  })

  it('rises with weight at a fixed height', () => {
    expect(computeBmi(90, 180)).toBeGreaterThan(computeBmi(80, 180))
  })

  it('falls with height at a fixed weight', () => {
    expect(computeBmi(80, 190)).toBeLessThan(computeBmi(80, 180))
  })

  it('returns null when either input is missing, rather than NaN or Infinity', () => {
    expect(computeBmi(null, 180)).toBeNull()
    expect(computeBmi(80, null)).toBeNull()
    expect(computeBmi(80, 0)).toBeNull()
    expect(computeBmi(0, 180)).toBeNull()
  })
})
