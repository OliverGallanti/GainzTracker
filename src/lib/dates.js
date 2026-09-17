export function startOfLocalDay(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

export function toLocalDateKey(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Walks backward from today counting consecutive present days. Falls back to
// starting from yesterday if today has no entry yet, so the streak doesn't
// read as broken the moment a new day starts before today's workout is logged.
export function computeStreak(dateKeys) {
  const present = new Set(dateKeys)
  const cursor = new Date()

  if (!present.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (present.has(toLocalDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
