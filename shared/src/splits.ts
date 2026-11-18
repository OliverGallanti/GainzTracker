import { startOfLocalWeek } from './dates'
import type { SplitLog, WorkoutSplit } from './types'

// How many days a week counts as a good week: the routine's own goal if it has
// one, otherwise as many days as the routine lists (capped at a real week).
export function weeklyGoal(split: Pick<WorkoutSplit, 'daysPerWeek' | 'days'>) {
  return split.daysPerWeek ?? Math.min(7, Math.max(1, split.days.length))
}

// Weekly streak: consecutive Monday-Sunday weeks in which at least `goal` distinct
// days were completed (skipped days don't count). The week in progress never
// breaks the streak: if it's already met it counts, otherwise counting starts
// from last week and this week is still open. `logs` may come from several
// routines, so a routine change doesn't reset it; each day counts once.
export function computeWeeklyStreak(logs: Pick<SplitLog, 'completed' | 'loggedAt'>[], goal: number, now = new Date()) {
  const daysByWeek = new Map<number, Set<string>>()
  for (const log of logs) {
    if (!log.completed) continue
    const loggedAt = new Date(log.loggedAt)
    const week = startOfLocalWeek(loggedAt).getTime()
    const days = daysByWeek.get(week) ?? new Set<string>()
    days.add(loggedAt.toDateString())
    daysByWeek.set(week, days)
  }
  const daysIn = (week: Date) => daysByWeek.get(week.getTime())?.size ?? 0
  const previousWeek = (week: Date) => {
    const previous = new Date(week)
    previous.setDate(previous.getDate() - 7)
    return previous
  }

  const thisWeek = startOfLocalWeek(now)
  const thisWeekDays = daysIn(thisWeek)

  let cursor = thisWeekDays >= goal ? thisWeek : previousWeek(thisWeek)
  let streak = 0
  while (daysIn(cursor) >= goal) {
    streak += 1
    cursor = previousWeek(cursor)
  }

  return { streak, thisWeekDays, goal }
}

// The user may log any day in any order; this only picks what to preselect: the
// day after whatever was logged last, in the split's listed order.
export function suggestedDayIndex(days: string[], logs: Pick<SplitLog, 'dayIndex'>[]) {
  return logs.length ? (logs[0].dayIndex + 1) % days.length : 0
}

// Splits like PPL repeat labels (Push, Pull, Legs, Push, ...); the picker wants
// each once, mapped to the first index that has it.
export function uniqueDays(days: string[]) {
  return days.flatMap((label, index) => (days.indexOf(label) === index ? [{ label, index }] : []))
}

// The log on a calendar day (this device's day), if there is one: at most one
// per day, which the server enforces.
export function logOnDay<T extends Pick<SplitLog, 'loggedAt'>>(logs: T[], date: Date): T | undefined {
  return logs.find((log) => new Date(log.loggedAt).toDateString() === date.toDateString())
}
