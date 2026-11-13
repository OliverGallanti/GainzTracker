// The server accepts goals only for these (liftGoalsSchema in schemas.ts).
// These are the same display names WorkoutSet.exerciseName and LiftGoal
// .exerciseName use, so a lift's name is its own key everywhere — there's no
// separate name -> field mapping to keep in sync.
export const BIG_FOUR_LIFTS = ['Deadlift', 'Squat', 'Bench Press', 'Overhead Press']

// Only RPE is stored: reps in reserve is the same scale read the other way.
export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
export const formatEffort = (rpe: number) => `RPE ${rpe} · RIR ${10 - rpe}`
