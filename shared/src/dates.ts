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

// n days from a date (negative goes back), local time and DST safe like the week.
export function addDays(date: Date, n: number) {
  const day = new Date(date)
  day.setDate(day.getDate() + n)
  return day
}

// A local day as an API range: ?since=…&until=… on /api/meals.
export function dayRange(date: Date) {
  const since = startOfLocalDay(date)
  const until = new Date(addDays(since, 1).getTime() - 1)
  return { since: since.toISOString(), until: until.toISOString() }
}

// When a food logged "on" a day happened: now for today, midday for a past day
// (filled in later, so the hour isn't known; midday stays inside the day).
export function loggedAtOn(day: Date, now = new Date()) {
  if (startOfLocalDay(day).getTime() === startOfLocalDay(now).getTime()) return now.toISOString()
  const midday = startOfLocalDay(day)
  midday.setHours(12)
  return midday.toISOString()
}

// "Today", "Yesterday", or "Mon 16 Nov".
export function dayLabel(day: Date, today = new Date()) {
  const key = startOfLocalDay(day).getTime()
  if (key === startOfLocalDay(today).getTime()) return 'Today'
  if (key === startOfLocalDay(addDays(today, -1)).getTime()) return 'Yesterday'
  return day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
