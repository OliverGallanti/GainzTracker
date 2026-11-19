import { DAY_COLORS, type DayColor } from '@gainz/shared/dayColors'
import { uniqueDays } from '@gainz/shared/splits'
import type { WorkoutSplit } from '@gainz/shared/types'

// A colour for each of a routine's days (by name), shown on the calendar.
// Each pick is saved straight away with the whole map.
function DayColorsForm({
  split,
  busy,
  onChange,
}: {
  split: Pick<WorkoutSplit, 'days' | 'dayColors'>
  busy: boolean
  onChange: (dayColors: Record<string, DayColor>) => void
}) {
  const pick = (day: string, color: DayColor | null) => {
    const next = { ...split.dayColors } as Record<string, DayColor>
    if (color) next[day] = color
    else delete next[day]
    onChange(next)
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-secondary/25 p-3">
      <p className="text-xs text-third/60">A colour for each day, shown on the calendar</p>
      {uniqueDays(split.days).map(({ label }) => (
        <div key={label} className="flex flex-wrap items-center gap-2">
          <span className="w-20 truncate text-xs text-third">{label}</span>
          {([null, ...Object.keys(DAY_COLORS)] as (DayColor | null)[]).map((key) => {
            const picked = (split.dayColors?.[label] ?? null) === key
            return (
              <button
                key={key ?? 'none'}
                type="button"
                disabled={busy}
                onClick={() => pick(label, key)}
                aria-label={`${label}: ${key ?? 'no colour'}`}
                aria-pressed={picked}
                style={{ backgroundColor: key ? DAY_COLORS[key] : undefined }}
                className={`h-6 w-6 rounded-full border-2 transition ${key ? '' : 'bg-third'} ${picked ? 'border-third' : 'border-transparent hover:border-third/40'}`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default DayColorsForm
