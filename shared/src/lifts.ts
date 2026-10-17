// Must match LIFTS in server/src/routes/lift-goals.ts (a test pins this list).
// These are the same display names WorkoutSet.exerciseName and LiftGoal
// .exerciseName use, so a lift's name is its own key everywhere — there's no
// separate name -> field mapping to keep in sync.
export const BIG_FOUR_LIFTS = ['Deadlift', 'Squat', 'Bench Press', 'Overhead Press']
