// `logs` must be sorted newest-first (the API already returns them this way).
// Counts consecutive completed entries from the most recent log backward —
// no calendar-gap logic needed, since every log already corresponds to
// exactly one position in the rotating cycle, not a calendar date.
export function computeAdherenceStreak(logs) {
  let streak = 0
  for (const log of logs) {
    if (!log.completed) break
    streak += 1
  }
  return streak
}

// Both completed and skipped logs consume a cycle position, so the next
// index is just how many logs exist so far, wrapped to the split's length.
export function nextDayIndex(days, logs) {
  return logs.length % days.length
}
