export function startOfLocalDay(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

// Weeks run Monday to Sunday (the ISO/European convention). Local time, and built
// with setDate rather than adding 7 * 24h so a daylight-saving change can't shift it.
export function startOfLocalWeek(date = new Date()) {
  const start = startOfLocalDay(date)
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  return start
}
