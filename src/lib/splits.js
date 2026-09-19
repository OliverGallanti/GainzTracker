import { startOfLocalWeek } from './dates'

// How many days a week counts as a good week: the routine's own goal if it has
// one, otherwise as many days as the routine lists (capped at a real week).
export function weeklyGoal(split) {
  return split.daysPerWeek ?? Math.min(7, Math.max(1, split.days.length))
}

// Weekly streak: consecutive Monday-Sunday weeks in which at least `goal` distinct
// days were completed (skipped days don't count). The week in progress never
// breaks the streak: if it's already met it counts, otherwise counting starts
// from last week and this week is still open. `logs` may come from several
// routines, so a routine change doesn't reset it; each day counts once.
export function computeWeeklyStreak(logs, goal, now = new Date()) {
  const daysByWeek = new Map()
  for (const log of logs) {
    if (!log.completed) continue
    const loggedAt = new Date(log.loggedAt)
    const week = startOfLocalWeek(loggedAt).getTime()
    if (!daysByWeek.has(week)) daysByWeek.set(week, new Set())
    daysByWeek.get(week).add(loggedAt.toDateString())
  }
  const daysIn = (week) => daysByWeek.get(week.getTime())?.size ?? 0
  const previousWeek = (week) => {
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
export function suggestedDayIndex(days, logs) {
  return logs.length ? (logs[0].dayIndex + 1) % days.length : 0
}

// Splits like PPL repeat labels (Push, Pull, Legs, Push, ...); the picker wants
// each once, mapped to the first index that has it.
export function uniqueDays(days) {
  return days.flatMap((label, index) => (days.indexOf(label) === index ? [{ label, index }] : []))
}
