import { describe, expect, it } from 'vitest'
import {
  createLogSchema,
  createMealSchema,
  createSetSchema,
  createWeightSchema,
  liftGoalsSchema,
  saveFoodSchema,
  updateLogSchema,
  updateMealSchema,
  updateMeSchema,
} from './schemas'

// The server's request rules: what each route accepts and refuses.
describe('request schemas', () => {
  it('accepts a phone-made id, or none, and refuses anything else', () => {
    expect(createWeightSchema.safeParse({ id: '3b241101-e2bb-4255-8caf-4136c566a962', weightKg: 80 }).success).toBe(true)
    expect(createWeightSchema.safeParse({ weightKg: 80 }).success).toBe(true)
    expect(createWeightSchema.safeParse({ id: 'not-a-uuid', weightKg: 80 }).success).toBe(false)
  })

  it('reads dates sent as ISO strings', () => {
    const parsed = createMealSchema.parse({ description: 'Banana', calories: 93, loggedAt: '2026-11-12T09:00:00.000Z' })
    expect(parsed.loggedAt).toEqual(new Date('2026-11-12T09:00:00.000Z'))
  })

  it('logs a meal with an amount in grams or servings only', () => {
    expect(createMealSchema.safeParse({ description: 'Banana', calories: 93, amount: 120, unit: 'g' }).success).toBe(true)
    expect(createMealSchema.safeParse({ description: 'Banana', calories: 93, amount: 120, unit: 'cups' }).success).toBe(false)
    expect(createMealSchema.safeParse({ description: 'Banana', calories: 93.5 }).success).toBe(false) // whole calories
  })

  it('edits a meal with any subset, null clearing a field', () => {
    expect(updateMealSchema.parse({ mealName: null, proteinG: null })).toEqual({ mealName: null, proteinG: null })
    expect(updateMealSchema.safeParse({ mealName: '' }).success).toBe(false)
  })

  it('saves a food per serving unless it says per 100 g', () => {
    expect(saveFoodSchema.parse({ name: ' Oats ', calories: 389 })).toEqual({ name: 'Oats', calories: 389, basis: 'serving' })
    expect(saveFoodSchema.parse({ name: 'Oats', calories: 389, basis: '100g', servingG: 40 }).basis).toBe('100g')
    expect(saveFoodSchema.safeParse({ name: 'Oats', calories: 389, basis: 'cup' }).success).toBe(false)
  })

  it('refuses an update with nothing in it', () => {
    expect(updateMeSchema.safeParse({}).success).toBe(false)
    expect(updateLogSchema.safeParse({}).success).toBe(false)
    expect(updateMeSchema.safeParse({ heightCm: 180 }).success).toBe(true)
  })

  it('checks profile values against the known lists', () => {
    expect(updateMeSchema.safeParse({ activityLevel: 'moderate' }).success).toBe(true)
    expect(updateMeSchema.safeParse({ activityLevel: 'couch' }).success).toBe(false)
    expect(updateMeSchema.safeParse({ mealNames: ['Lunch', 'Lunch'] }).success).toBe(false)
    expect(updateMeSchema.safeParse({ mealNames: Array.from({ length: 9 }, (_, i) => `Meal ${i}`) }).success).toBe(false)
  })

  it('takes goals for some of the Big 4, and only those', () => {
    expect(liftGoalsSchema.safeParse({ Squat: 150 }).success).toBe(true)
    expect(liftGoalsSchema.safeParse({}).success).toBe(false)
    expect(liftGoalsSchema.safeParse({ Curl: 40 }).success).toBe(false)
    expect(liftGoalsSchema.safeParse({ Squat: -1 }).success).toBe(false)
  })

  it('takes RPE in half steps from 6 to 10', () => {
    const set = { exerciseName: 'Squat', weightKg: 100, reps: 5 }
    expect(createSetSchema.safeParse({ ...set, rpe: 8.5 }).success).toBe(true)
    expect(createSetSchema.safeParse({ ...set, rpe: 8.3 }).success).toBe(false)
    expect(createSetSchema.safeParse({ ...set, rpe: 5 }).success).toBe(false)
  })

  it('needs the day bounds to log a training day', () => {
    const day = { completed: true, dayIndex: 0, dayStart: '2026-11-12T00:00:00Z', dayEnd: '2026-11-12T23:59:59Z', loggedAt: '2026-11-12T10:00:00Z' }
    expect(createLogSchema.safeParse(day).success).toBe(true)
    expect(createLogSchema.safeParse({ ...day, dayEnd: undefined }).success).toBe(false)
  })
})
