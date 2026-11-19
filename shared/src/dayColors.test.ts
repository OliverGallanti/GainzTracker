import { describe, expect, it } from 'vitest'
import { DAY_COLORS, dayColor } from './dayColors'

describe('dayColor', () => {
  const split = { days: ['Push', 'Pull', 'Legs', 'Push'], dayColors: { Push: 'red', Legs: 'nope' } }

  it('colours a day by its name, so repeated days match', () => {
    expect(dayColor(split, 0)).toBe(DAY_COLORS.red)
    expect(dayColor(split, 3)).toBe(DAY_COLORS.red)
  })

  it('is null for an uncoloured day, an unknown colour or no colours at all', () => {
    expect(dayColor(split, 1)).toBeNull()
    expect(dayColor(split, 2)).toBeNull()
    expect(dayColor({ days: ['Push'], dayColors: null }, 0)).toBeNull()
  })
})
