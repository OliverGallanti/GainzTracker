import { describe, expect, it } from 'vitest'
import { getStrengthReferenceLines, getStrengthTier, STRENGTH_STANDARDS } from './strength'

describe('getStrengthTier', () => {
  // Male squat thresholds are [1.0, 1.5, 2.0, 2.5] — bodyweight 100kg keeps
  // the arithmetic obvious, so a lift in kg reads directly as a ratio.
  it('returns Beginner below the first threshold', () => {
    expect(getStrengthTier('Squat', 99, 100, 'male').label).toBe('Beginner')
  })

  it('treats each threshold as inclusive — exactly at the boundary is the higher tier', () => {
    expect(getStrengthTier('Squat', 100, 100, 'male').label).toBe('Novice')
    expect(getStrengthTier('Squat', 150, 100, 'male').label).toBe('Intermediate')
    expect(getStrengthTier('Squat', 200, 100, 'male').label).toBe('Advanced')
    expect(getStrengthTier('Squat', 250, 100, 'male').label).toBe('Elite / Pro')
  })

  it('stays in the lower tier just under a boundary', () => {
    expect(getStrengthTier('Squat', 149.9, 100, 'male').label).toBe('Novice')
  })

  it('does not cap out — anything above Elite is still Elite', () => {
    expect(getStrengthTier('Squat', 400, 100, 'male').label).toBe('Elite / Pro')
  })

  it('uses sex-specific standards', () => {
    // 1.0x bodyweight bench: Intermediate for men (1.2 needed for the next
    // tier), but exactly Advanced for women.
    expect(getStrengthTier('Bench Press', 70, 70, 'male').label).toBe('Novice')
    expect(getStrengthTier('Bench Press', 70, 70, 'female').label).toBe('Advanced')
  })

  it('returns null rather than guessing when an input is missing', () => {
    expect(getStrengthTier('Squat', null, 100, 'male')).toBeNull()
    expect(getStrengthTier('Squat', 100, null, 'male')).toBeNull()
    expect(getStrengthTier('Squat', 100, 100, null)).toBeNull()
    expect(getStrengthTier('Squat', 0, 100, 'male')).toBeNull()
  })

  it('returns null for an unknown lift or sex', () => {
    expect(getStrengthTier('Bicep Curl', 100, 100, 'male')).toBeNull()
    expect(getStrengthTier('Squat', 100, 100, 'other')).toBeNull()
  })
})

describe('getStrengthReferenceLines', () => {
  it('converts every threshold to absolute kg for this bodyweight', () => {
    expect(getStrengthReferenceLines('Squat', 100, 'male')).toEqual([
      { label: 'Novice', value: 100 },
      { label: 'Intermediate', value: 150 },
      { label: 'Advanced', value: 200 },
      { label: 'Elite / Pro', value: 250 },
    ])
  })

  it('rounds to one decimal so the chart labels stay readable', () => {
    // 82.2kg male deadlift, first threshold 1.2 => 98.64 -> 98.6
    expect(getStrengthReferenceLines('Deadlift', 82.2, 'male')[0].value).toBe(98.6)
  })

  it('never labels a Beginner line — it has no threshold of its own', () => {
    const labels = getStrengthReferenceLines('Squat', 100, 'male').map((l) => l.label)
    expect(labels).not.toContain('Beginner')
    expect(labels).toHaveLength(4)
  })

  it('returns an empty list when bodyweight or sex is missing', () => {
    expect(getStrengthReferenceLines('Squat', null, 'male')).toEqual([])
    expect(getStrengthReferenceLines('Squat', 100, null)).toEqual([])
  })
})

describe('STRENGTH_STANDARDS', () => {
  it('lists four ascending thresholds for every lift and sex', () => {
    for (const [sex, lifts] of Object.entries(STRENGTH_STANDARDS)) {
      for (const [lift, thresholds] of Object.entries(lifts)) {
        expect(thresholds, `${sex}/${lift}`).toHaveLength(4)
        const ascending = [...thresholds].sort((a, b) => a - b)
        expect(thresholds, `${sex}/${lift} must be ascending`).toEqual(ascending)
      }
    }
  })
})
