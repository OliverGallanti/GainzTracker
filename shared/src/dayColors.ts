import type { WorkoutSplit } from './types.ts'

// The colours a routine's days can be given, by name, so the training calendar
// shows which day was which. Light enough for the dark theme's text on top;
// no amber, which means "skipped".
export const DAY_COLORS = {
  red: '#f87171',
  orange: '#fb923c',
  green: '#4ade80',
  teal: '#2dd4bf',
  blue: '#60a5fa',
  violet: '#a78bfa',
  pink: '#f472b6',
} as const

export type DayColor = keyof typeof DAY_COLORS
export const DAY_COLOR_KEYS = Object.keys(DAY_COLORS) as [DayColor, ...DayColor[]]

// The colour of a routine's day (by its name, so both "Push" days match), or null.
export function dayColor(split: Pick<WorkoutSplit, 'days' | 'dayColors'>, dayIndex: number): string | null {
  const key = split.dayColors?.[split.days[dayIndex]]
  return key && key in DAY_COLORS ? DAY_COLORS[key as DayColor] : null
}
