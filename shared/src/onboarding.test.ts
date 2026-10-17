import { describe, expect, it } from 'vitest'
import { missingProfileFields, onboardingSteps } from './onboarding'

const complete = { sex: 'male' as const, age: 30, activityLevel: 'moderate', heightCm: 180 }

describe('missingProfileFields', () => {
  it('lists what is blank, in a stable order', () => {
    expect(missingProfileFields({ sex: null, age: null, activityLevel: null })).toEqual(['sex', 'age', 'activity level'])
    expect(missingProfileFields({ sex: 'female', age: null, activityLevel: 'light' })).toEqual(['age'])
  })

  it('is empty when the profile is complete', () => {
    expect(missingProfileFields(complete)).toEqual([])
  })
})

describe('onboardingSteps', () => {
  const entry = { weightKg: 80 }

  it('is all done for a set-up user', () => {
    expect(onboardingSteps(complete, [entry]).every((s) => s.done)).toBe(true)
  })

  it('a brand-new user has both steps open, with what is missing', () => {
    const steps = onboardingSteps({ sex: null, age: null, activityLevel: null, heightCm: null }, [])
    expect(steps.map((s) => s.done)).toEqual([false, false])
    expect(steps[0].missing).toEqual(['sex', 'age', 'activity level'])
    expect(steps[1].missing).toEqual(['height', 'first weight'])
  })

  it('tracks the two steps independently', () => {
    const steps = onboardingSteps(complete, [])
    expect(steps.map((s) => s.done)).toEqual([true, false])
    expect(steps[1].missing).toEqual(['first weight'])
    expect(onboardingSteps({ ...complete, heightCm: null }, [entry])[1].missing).toEqual(['height'])
  })
})
