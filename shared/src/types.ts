// Shapes the API returns, as the client uses them. Dates arrive as ISO strings.

export type Sex = 'male' | 'female'

export interface Me {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  heightCm: number | null
  weightGoalKg: number | null
  bodyFatGoalPercent: number | null
  sex: Sex | null
  age: number | null
  activityLevel: string | null
  mealNames: string[]
}

export interface WeightEntry {
  id: string
  weightKg: number
  bodyFatPercent: number | null
  loggedAt: string
}

export interface Macros {
  calories: number
  proteinG: number | null
  fatG: number | null
  carbsG: number | null
}

export interface Meal extends Macros {
  id: string
  description: string
  mealName: string | null
  loggedAt: string
}

export interface WorkoutSplit {
  id: string
  name: string
  days: string[]
  daysPerWeek: number | null
  active: boolean
}

export interface SplitLog {
  id: string
  splitId: string
  dayIndex: number
  completed: boolean
  loggedAt: string
  durationMinutes: number | null
}

export interface MacroGoal {
  proteinG: number
  fatG: number
  carbsG: number
  calorieTarget: number | null
}

export interface SavedFood extends Macros {
  id: string
  name: string
}

// GET /api/products/:barcode (Open Food Facts, normalized by the server).
export interface Product {
  barcode: string
  name: string
  brand: string | null
  servingSize: string | null
  servingG: number | null
  per100g: { calories: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null }
}

export interface WorkoutSet {
  id: string
  exerciseName: string
  weightKg: number | null
  reps: number | null
  performedAt: string
  splitLogId?: string | null // the training day it was logged in, if any
}

export interface Passkey {
  id: string
  deviceLabel: string | null
  createdAt: string
  lastUsedAt: string | null
}
