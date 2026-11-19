import type { WorkoutSplit } from './types.ts'

// A routine's days can each have a colour and an icon, by day name (so both
// "Push" days of a PPL match). Each app maps the icon keys to its own icon set
// (lucide, the same names on both).

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

// What each icon is for, as TalkBack and tooltips say it.
export const DAY_ICONS = {
  dumbbell: 'Weights',
  biceps: 'Arms',
  legs: 'Legs',
  endurance: 'Endurance',
  bike: 'Cycling',
  cardio: 'Cardio',
  core: 'Core',
  stretch: 'Mobility',
  swim: 'Swimming',
  hike: 'Hiking',
  flame: 'Intense',
  power: 'Power',
} as const

export type DayIcon = keyof typeof DAY_ICONS
export const DAY_ICON_KEYS = Object.keys(DAY_ICONS) as [DayIcon, ...DayIcon[]]

type Styled = Pick<WorkoutSplit, 'days' | 'dayColors' | 'dayIcons'>

// The colour of a routine's day (by its name, so both "Push" days match), or null.
export function dayColor(split: Pick<WorkoutSplit, 'days' | 'dayColors'>, dayIndex: number): string | null {
  return colorFor(split.dayColors?.[split.days[dayIndex]])
}

// A colour key as its hex, null when unset or unknown.
export const colorFor = (key: string | undefined | null): string | null =>
  key && key in DAY_COLORS ? DAY_COLORS[key as DayColor] : null

// The colour key of a day by name, null when unset or unknown.
export function dayColorKey(split: Pick<Styled, 'dayColors'>, dayName: string): DayColor | null {
  const key = split.dayColors?.[dayName]
  return key && key in DAY_COLORS ? (key as DayColor) : null
}

// The icon key of a day by name, null when unset or unknown.
export function dayIcon(split: Pick<Styled, 'dayIcons'>, dayName: string): DayIcon | null {
  const key = split.dayIcons?.[dayName]
  return key && key in DAY_ICONS ? (key as DayIcon) : null
}

// The day's style maps with one day's colour and icon changed (null removes it).
export function withDayStyle(split: Pick<Styled, 'dayColors' | 'dayIcons'>, dayName: string, color: DayColor | null, icon: DayIcon | null) {
  const set = <T extends string>(map: Record<string, string> | null | undefined, value: T | null) => {
    const next = { ...map } as Record<string, T>
    if (value) next[dayName] = value
    else delete next[dayName]
    return next
  }
  return { dayColors: set(split.dayColors, color), dayIcons: set(split.dayIcons, icon) }
}
