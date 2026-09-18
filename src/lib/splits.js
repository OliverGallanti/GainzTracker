// `logs` must be sorted newest-first (the API already returns them this way).
// Counts consecutive completed entries from the most recent log backward —
// deliberately by log, not by calendar gap, so a rest day doesn't break it.
export function computeAdherenceStreak(logs) {
  let streak = 0
  for (const log of logs) {
    if (!log.completed) break
    streak += 1
  }
  return streak
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
