import { describe, expect, it } from 'vitest'
import { SPLIT_TEMPLATES } from './templates'

// Adding a template is meant to be a one-line change to this array, so the
// only thing worth guarding is that a new entry is shaped like the others.
describe('SPLIT_TEMPLATES', () => {
  it('gives every template a name and at least one day', () => {
    for (const template of SPLIT_TEMPLATES) {
      expect(template.name, JSON.stringify(template)).toBeTruthy()
      expect(template.days.length, template.name).toBeGreaterThan(0)
      expect(template.days.every((d) => typeof d === 'string' && d.length > 0), template.name).toBe(true)
    }
  })

  it('has no duplicate template names', () => {
    const names = SPLIT_TEMPLATES.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
