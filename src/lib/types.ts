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
  dayIndex: number
  completed: boolean
  loggedAt: string
  durationMinutes: number | null
}
