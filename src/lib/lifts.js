export const BIG_FOUR_LIFTS = ['Deadlift', 'Squat', 'Bench Press', 'Overhead Press']

// Each lift's goal is its own column on User (see server/prisma/schema.prisma),
// so the UI needs this lift-name -> field-name mapping to read and write them.
export const GOAL_FIELD = {
  Deadlift: 'deadliftGoalKg',
  Squat: 'squatGoalKg',
  'Bench Press': 'benchPressGoalKg',
  'Overhead Press': 'overheadPressGoalKg',
}
