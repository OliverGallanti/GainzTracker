

export const INPUT = 'rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-sm text-third outline-none focus:border-secondary'
export const SECTION = 'rounded-xl border border-secondary/30 p-4'
export const round1 = (n: number) => Math.round(n * 10) / 10
export const text = (value: number | null) => (value == null ? '' : String(round1(value)))
export const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))
// The API's optional fields are "absent", not null.
export const withoutNulls = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, v]) => v != null))

// Saved foods last logged, newest first, kept in this browser only (the server
// lists them by name). ponytail: per browser, not synced with the phone's list.
export const RECENT_KEY = 'recentFoods'
export const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

export const SAVED_FOODS_KEY = ['savedFoods']
