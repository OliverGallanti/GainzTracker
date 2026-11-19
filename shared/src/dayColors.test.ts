import { describe, expect, it } from 'vitest'
import { DAY_COLORS, dayColor, dayIcon, withDayStyle } from './dayColors'

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

describe('day icons and styles', () => {
  it('finds a day icon by name, null for unknown', () => {
    const split = { dayIcons: { Push: 'dumbbell', Legs: 'rocket' } }
    expect(dayIcon(split, 'Push')).toBe('dumbbell')
    expect(dayIcon(split, 'Legs')).toBeNull()
    expect(dayIcon({ dayIcons: null }, 'Push')).toBeNull()
  })

  it('changes one day and keeps the others, null removing', () => {
    const split = { dayColors: { Push: 'red', Pull: 'blue' }, dayIcons: { Push: 'dumbbell' } }
    expect(withDayStyle(split, 'Push', 'green', null)).toEqual({ dayColors: { Push: 'green', Pull: 'blue' }, dayIcons: {} })
    expect(split.dayColors.Push).toBe('red')
  })
})
