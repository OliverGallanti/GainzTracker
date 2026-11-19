import { useState } from 'react'
import { buildMonthGrid, startOfLocalDay } from '@gainz/shared/dates'

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// not filled = amber; note is read out, e.g. 'done'; color: a filled day's own colour
export type DayMark = { filled: boolean; note: string; color?: string | null }

// A month to pick a day from: marked days filled in, any past day or today can
// be picked, future days can't. Today and re-clicking the picked day both mean
// "back to the default" (null). `onMonth` says which month is shown, to load its marks.
function MonthGrid({
  mark,
  selected,
  onSelect,
  onMonth,
}: {
  mark: (date: Date) => DayMark | undefined
  selected: Date
  onSelect: (date: Date | null) => void
  onMonth?: (month: Date) => void
}) {
  const today = new Date()
  const tomorrowStart = new Date(startOfLocalDay(today).getTime() + 24 * 60 * 60 * 1000)
  const [viewDate, setViewDate] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))
  const isCurrentMonth = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth()
  const selectedKey = selected.toDateString()

  const turn = (by: number) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + by, 1)
    setViewDate(next)
    onMonth?.(next)
  }
  const selectCell = (date: Date) => {
    const key = date.toDateString()
    onSelect(key === today.toDateString() || key === selectedKey ? null : date)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => turn(-1)} className="px-1 text-third/60 transition hover:text-third" aria-label="Previous month">
          ←
        </button>
        <p className="text-xs font-medium text-third">{viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        <button
          type="button"
          onClick={() => turn(1)}
          disabled={isCurrentMonth}
          className="px-1 text-third/60 transition hover:text-third disabled:opacity-30"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-third/60">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {buildMonthGrid(viewDate).map((date, i) => {
          if (!date) return <span key={i} />

          const marked = mark(date)
          const isToday = date.toDateString() === today.toDateString()
          const isSelected = date.toDateString() === selectedKey
          const selectable = date < tomorrowStart

          let classes = 'flex h-8 items-center justify-center rounded-lg text-xs transition'
          if (marked?.filled) {
            classes += ' bg-third font-medium text-main'
          } else if (marked) {
            classes += ' bg-amber-400/80 font-medium text-main'
          } else {
            classes += selectable ? ' text-third/60 hover:bg-third/10' : ' text-third/30'
          }
          if (isToday) classes += ' ring-1 ring-secondary'
          if (isSelected) classes += ' ring-2 ring-third'

          return (
            <button
              key={i}
              type="button"
              onClick={() => selectCell(date)}
              disabled={!selectable}
              aria-pressed={isSelected}
              style={marked?.filled && marked.color ? { backgroundColor: marked.color } : undefined}
              aria-label={`${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}${marked ? `, ${marked.note}` : ''}`}
              className={classes}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MonthGrid
