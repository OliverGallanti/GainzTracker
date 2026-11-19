import type { ReplaceSetsBody } from './schemas.ts'
import type { SplitLog, WorkoutSet, WorkoutSplit } from './types.ts'

export type PlannedSet = { weightKg: number | null; reps: number | null }
export type PlannedExercise = { name: string; sets: PlannedSet[] }

// What to do today, from the last time this day was trained: the newest done
// log of this routine's same day (by name, so either "Push" of a PPL counts) that has
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
    .filter((log) => log.splitId === split.id && log.completed && log.id !== exceptLogId && split.days[log.dayIndex] === day && byLog.has(log.id))
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

// A session form's row: the inputs' text, plus what the form doesn't show
// (effort, the live timer's times, when it was done), carried through an edit.
// `sets` is how many times the row was done (blank = 1): "3 x 10 @ 80".
export type SetRow = {
  exerciseName: string
  weightKg: string
  reps: string
  sets?: string
  kept?: Pick<WorkoutSet, 'rpe' | 'durationSeconds' | 'restSeconds' | 'performedAt'>
}

export const setRow = (set: WorkoutSet): SetRow => ({
  exerciseName: set.exerciseName,
  weightKg: set.weightKg == null ? '' : String(set.weightKg),
  reps: set.reps == null ? '' : String(set.reps),
  kept: { rpe: set.rpe, durationSeconds: set.durationSeconds, restSeconds: set.restSeconds, performedAt: set.performedAt },
})

// A session's sets as form rows, in the order done (the API lists newest
// first). Repeats of the same set in a row fold into one row with a count;
// timed sets don't, so each keeps its own times.
export function toSetRows(sets: WorkoutSet[]): SetRow[] {
  const rows: SetRow[] = []
  const untimed = (r: SetRow) => r.kept?.durationSeconds == null && r.kept?.restSeconds == null
  for (const set of [...sets].reverse()) {
    const row = setRow(set)
    const prev = rows.at(-1)
    const same =
      prev &&
      untimed(prev) &&
      untimed(row) &&
      prev.exerciseName === row.exerciseName &&
      prev.weightKg === row.weightKg &&
      prev.reps === row.reps &&
      prev.kept?.rpe === row.kept?.rpe
    if (same) prev.sets = String(Number(prev.sets ?? 1) + 1)
    else rows.push(row)
  }
  return rows
}

// The rows as the body of a session save (PUT .../logs/:logId/sets): rows with
// no exercise are left out, empty values are left out (not sent as null), and
// a row done N times is sent as N sets.
export const MAX_SETS_PER_ROW = 20

export function setsBody(rows: SetRow[]): ReplaceSetsBody {
  const number = (text: string) => (text.trim() && Number.isFinite(Number(text)) ? Number(text) : null)
  return {
    sets: rows
      .filter((r) => r.exerciseName.trim())
      .flatMap((r) => {
        const set = { exerciseName: r.exerciseName.trim(), weightKg: number(r.weightKg), reps: number(r.reps), ...r.kept }
        const body = Object.fromEntries(Object.entries(set).filter(([, v]) => v != null)) as ReplaceSetsBody['sets'][number]
        const times = Math.min(Math.max(Math.floor(number(r.sets ?? '') ?? 1), 1), MAX_SETS_PER_ROW)
        return Array.from({ length: times }, () => ({ ...body }))
      }),
  }
}
