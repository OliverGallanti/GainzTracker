import { useEffect, useState, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { lastSessionPlan, sessionExercises } from '@gainz/shared/sessions'
import type { SplitLog, WorkoutSet, WorkoutSplit } from '@gainz/shared/types'

// The workout in progress, on this phone only. Clocks are kept as start times,
// never as counters, so they stay right while the app is in the background or
// closed; it's saved on every change, so a killed app picks up where it was.
// Finished sets don't live here: each is queued to the server the moment it's
// done (see LiveWorkout), like any other set.

export type LiveSet = {
  weightKg: string // the inputs' text
  reps: string
  done?: { durationSeconds: number | null; restSeconds: number | null }
}
export type LiveExercise = { name: string; sets: LiveSet[] }
export type Workout = {
  splitId: string
  logId: string
  day: string
  startedAt: number
  exercises: LiveExercise[]
  running: { exercise: number; set: number; startedAt: number } | null // the set being done
  restStartedAt: number | null // since the last set finished
  restTarget: number // seconds
  open: boolean // on screen, or minimised to the bar above the tabs
}

const KEY = 'liveWorkout'
let current: Workout | null = null
const listeners = new Set<() => void>()

void AsyncStorage.getItem(KEY)
  .then((saved) => {
    if (saved && !current) {
      current = JSON.parse(saved) as Workout
      listeners.forEach((l) => l())
    }
  })
  .catch(() => {})

export function setWorkout(next: Workout | null) {
  current = next
  listeners.forEach((l) => l())
  void (next ? AsyncStorage.setItem(KEY, JSON.stringify(next)) : AsyncStorage.removeItem(KEY)).catch(() => {})
}

export function useWorkout() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}

// Starts (or picks back up) a live session on a training day. A day that
// already has sets carries on from them, its time included; a fresh one is
// filled in from the last session of the same day ("repeat last session").
export function startWorkout(split: WorkoutSplit, log: Pick<SplitLog, 'id' | 'dayIndex' | 'durationMinutes'>, logs: SplitLog[], sets: WorkoutSet[]) {
  const own = sets.filter((s) => s.splitLogId === log.id)
  const text = (n: number | null) => (n == null ? '' : String(n))
  const exercises: LiveExercise[] =
    own.length > 0
      ? sessionExercises(own).map((e) => ({
          name: e.name,
          sets: e.sets.map((s) => ({ weightKg: text(s.weightKg), reps: text(s.reps), done: { durationSeconds: s.durationSeconds ?? null, restSeconds: s.restSeconds ?? null } })),
        }))
      : lastSessionPlan(split, logs, sets, log.dayIndex, log.id).map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ weightKg: text(s.weightKg), reps: text(s.reps) })) }))
  setWorkout({
    splitId: split.id,
    logId: log.id,
    day: split.days[log.dayIndex],
    startedAt: Date.now() - (log.durationMinutes ?? 0) * 60000,
    exercises,
    running: null,
    restStartedAt: null,
    restTarget: 90,
    open: true,
  })
}

// Seconds since a start time.
export const since = (start: number, now: number) => Math.max(0, Math.round((now - start) / 1000))

// The time now, redrawn every second while `on`, for the clocks.
export function useNow(on = true) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!on) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [on])
  return now
}
