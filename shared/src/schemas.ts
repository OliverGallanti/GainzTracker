import { z } from 'zod'
import { BIG_FOUR_LIFTS } from './lifts.ts'
import { DAY_COLOR_KEYS } from './dayColors.ts'
import { ACTIVITY_LEVELS } from './tdee.ts'

// The API's request bodies, in one place: the server validates with these, and
// the clients take their request types from them (z.input), so a rule changes
// once for all three. Query strings are parsed on the server only.
// Imports carry `.ts` because the server runs this file in Node directly.

// An offline client (the mobile app) creates records with an id it made itself
// and may send the same create again after a dropped connection; the server
// returns the existing row for a repeated id. The browser doesn't send one.
export const clientId = z.uuid().optional()

// The user's meal slots are matched by name (MacroEntry.mealName).
const mealName = z.string().trim().min(1).max(30)

export const macroGoalSchema = z.object({
  proteinG: z.number().positive(),
  fatG: z.number().positive(),
  carbsG: z.number().positive(),
  calorieTarget: z.number().int().positive().optional(),
})

export const createWeightSchema = z.object({
  id: clientId,
  weightKg: z.number().positive(),
  bodyFatPercent: z.number().min(0).max(100).optional(),
  loggedAt: z.coerce.date().optional(),
  note: z.string().optional(),
})

// Edits a weigh-in: only the keys sent change; bodyFatPercent null clears it.
export const updateWeightSchema = z.object({
  weightKg: z.number().positive().optional(),
  bodyFatPercent: z.number().min(0).max(100).nullable().optional(),
  loggedAt: z.coerce.date().optional(),
})

// Every field optional: only the keys present are written, so editing one
// (e.g. height) never needs the others resent.
export const updateMeSchema = z
  .object({
    heightCm: z.number().positive().optional(),
    weightGoalKg: z.number().positive().optional(),
    bodyFatGoalPercent: z.number().min(0).max(100).optional(),
    sex: z.enum(['male', 'female']).optional(),
    age: z.number().int().positive().max(120).optional(),
    activityLevel: z
      .string()
      .refine((key) => ACTIVITY_LEVELS.some((level) => level.key === key), { message: 'Unknown activity level' })
      .optional(),
    // The whole ordered list replaces the old one; names must be unique.
    mealNames: z
      .array(mealName)
      .min(1)
      .max(8)
      .refine((names) => new Set(names).size === names.length, { message: 'Meal names must be unique' })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' })

const amountUnit = z.enum(['g', 'serving'])

export const createMealSchema = z.object({
  id: clientId,
  description: z.string().min(1),
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  mealName: mealName.optional(),
  amount: z.number().positive().optional(),
  unit: amountUnit.optional(),
  loggedAt: z.coerce.date().optional(),
})

// Any subset; a macro, mealName, amount or unit sent as null is cleared
// (mealName null = "Other").
export const updateMealSchema = z.object({
  description: z.string().min(1).optional(),
  calories: z.number().int().nonnegative().optional(),
  proteinG: z.number().nonnegative().nullable().optional(),
  carbsG: z.number().nonnegative().nullable().optional(),
  fatG: z.number().nonnegative().nullable().optional(),
  mealName: mealName.nullable().optional(),
  amount: z.number().positive().nullable().optional(),
  unit: amountUnit.nullable().optional(),
})

// Macros per one serving or per 100 g; servingG is a serving's weight, when known.
export const saveFoodSchema = z.object({
  name: z.string().trim().min(1).max(80),
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  basis: z.enum(['serving', '100g']).default('serving'),
  servingG: z.number().positive().optional(),
})

// How many completed days make a good week (the weekly streak's threshold).
const daysPerWeek = z.number().int().min(1).max(7)

export const createSplitSchema = z.object({
  id: clientId,
  name: z.string().min(1),
  days: z.array(z.string().min(1)).min(1),
  daysPerWeek: daysPerWeek.optional(),
})

// Day name -> colour key (dayColors.ts). Sent whole: it replaces the routine's map.
const dayColors = z.record(z.string().min(1).max(60), z.enum(DAY_COLOR_KEYS))

export const updateSplitSchema = z.object({ daysPerWeek: daysPerWeek.optional(), dayColors: dayColors.optional() })

// `dayIndex` is the user's pick from the split's days, in any order. `dayStart`
// and `dayEnd` bound the local calendar day being logged (the client knows its
// timezone); `loggedAt` places the log inside it, so past days can be filled in.
export const createLogSchema = z.object({
  id: clientId,
  completed: z.boolean(),
  dayIndex: z.number().int().min(0),
  dayStart: z.coerce.date(),
  dayEnd: z.coerce.date(),
  loggedAt: z.coerce.date(),
})

export const updateLogSchema = z
  .object({
    durationMinutes: z.number().int().positive().optional(),
    completed: z.boolean().optional(),
    dayIndex: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' })

const seconds = z.number().int().min(0).max(86400).optional() // a day at most

export const createSetSchema = z.object({
  id: clientId,
  splitLogId: z.string().optional(),
  exerciseName: z.string().min(1),
  weightKg: z.number().nonnegative().optional(),
  reps: z.number().int().nonnegative().optional(),
  rpe: z.number().min(6).max(10).multipleOf(0.5).optional(), // RPE_VALUES in lifts.ts
  durationSeconds: seconds,
  restSeconds: seconds,
  performedAt: z.coerce.date().optional(),
})

// A training day's sets, all of them: the server replaces the day's sets with
// these in one transaction, so a save can't stop halfway. Ids and the day come
// from the server and the URL.
export const replaceSetsSchema = z.object({
  sets: z.array(createSetSchema.omit({ id: true, splitLogId: true })).max(200),
})

// { "Deadlift": 200, "Squat": 150 }: only the lifts being changed, and only the
// Big 4 (so the table can't collect arbitrary keys). A refine rather than an
// enum-keyed record, which zod 4 reads as "every key required".
export const liftGoalsSchema = z
  .record(z.string(), z.number().positive())
  .refine((goals) => Object.keys(goals).length > 0, { message: 'No goals to update' })
  .refine((goals) => Object.keys(goals).every((name) => BIG_FOUR_LIFTS.includes(name)), { message: 'Unknown lift' })

// Request bodies as the clients send them.
export type UpdateMealBody = z.input<typeof updateMealSchema>
export type UpdateWeightBody = z.input<typeof updateWeightSchema>
export type UpdateLogBody = z.input<typeof updateLogSchema>
export type UpdateSplitBody = z.input<typeof updateSplitSchema>
export type LiftGoalsBody = z.input<typeof liftGoalsSchema>
export type ReplaceSetsBody = z.input<typeof replaceSetsSchema>
