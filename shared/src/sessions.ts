import type { SplitLog, WorkoutSet, WorkoutSplit } from './types.ts'

export type PlannedSet = { weightKg: number | null; reps: number | null }
export type PlannedExercise = { name: string; sets: PlannedSet[] }

// What to do today, from the last time this day was trained: the newest done
// log of the same day (by name, so either "Push" of a PPL counts) that has
// sets, its sets grouped by exercise in the order they were done. Empty when
// there's no such session yet.
export function lastSessionPlan(split: WorkoutSplit, logs: SplitLog[], sets: WorkoutSet[], dayIndex: number, exceptLogId?: string): PlannedExercise[] {
  const day = split.days[dayIndex]
  const byLog = new Map<string, WorkoutSet[]>()
  for (const set of sets) {
    if (!set.splitLogId) continue
    byLog.set(set.splitLogId, [...(byLog.get(set.splitLogId) ?? []), set])
  }
  const last = logs
    .filter((log) => log.completed && log.id !== exceptLogId && split.days[log.dayIndex] === day && byLog.has(log.id))
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0]
  if (!last) return []

  return sessionExercises(byLog.get(last.id)!).map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })) }))
}

// One session's sets grouped by exercise, in the order they were done. The
// API lists sets newest first; sets saved together share a time, so reversing
// first keeps them in the order they were entered.
export function sessionExercises(sets: WorkoutSet[]): { name: string; sets: WorkoutSet[] }[] {
  const done = [...sets].reverse().sort((a, b) => a.performedAt.localeCompare(b.performedAt))
  const exercises: { name: string; sets: WorkoutSet[] }[] = []
  for (const set of done) {
    let exercise = exercises.find((e) => e.name === set.exerciseName)
    if (!exercise) exercises.push((exercise = { name: set.exerciseName, sets: [] }))
    exercise.sets.push(set)
  }
  return exercises
}

// 65 → "1:05", 3725 → "1:02:05".
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(s % 60)}` : `${minutes}:${pad(s % 60)}`
}

// "0:45 · rest 1:30" for a timed set, '' for one that wasn't.
export function describeTiming(set: Pick<WorkoutSet, 'durationSeconds' | 'restSeconds'>): string {
  return [
    set.durationSeconds != null ? formatSeconds(set.durationSeconds) : null,
    set.restSeconds != null ? `rest ${formatSeconds(set.restSeconds)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
