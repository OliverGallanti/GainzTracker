export function startOfLocalDay(date: Date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

// One month for a Sunday-first calendar. Leading nulls pad the grid so day 1
// lands in the correct weekday column.
export function buildMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const cells: (Date | null)[] = Array(new Date(year, month, 1).getDay()).fill(null)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

// Weeks run Monday to Sunday (the ISO/European convention). Local time, and built
// with setDate rather than adding 7 * 24h so a daylight-saving change can't shift it.
export function startOfLocalWeek(date: Date = new Date()) {
  const start = startOfLocalDay(date)
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  return start
}
