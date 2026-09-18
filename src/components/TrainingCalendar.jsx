import { useState } from 'react'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Leading `null`s pad the grid so day 1 lands in the correct weekday column.
function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const startOffset = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

function TrainingCalendar({ logs, days, onRemove }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedLogId, setSelectedLogId] = useState(null)

  // Enforced once-per-day server-side, so this map is always at most one log per key.
  const logsByDate = new Map(logs.map((log) => [new Date(log.loggedAt).toDateString(), log]))

  const cells = buildMonthGrid(viewDate)
  const isCurrentMonth =
    viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth()
  const selectedLog = logs.find((l) => l.id === selectedLogId) ?? null

  const selectCell = (log) => {
    setSelectedLogId((current) => (current === log.id ? null : log.id))
  }

  return (
    <div className="mt-5 border-t border-secondary/25 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          className="px-1 text-third/60 transition hover:text-third"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="text-xs font-medium text-third">
          {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
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
        {cells.map((date, i) => {
          if (!date) return <span key={i} />

          const log = logsByDate.get(date.toDateString())
          const isToday = date.toDateString() === today.toDateString()
          const isSelected = log?.id === selectedLogId

          let classes = 'flex h-8 items-center justify-center rounded-lg text-xs transition'
          if (log?.completed) {
            classes += ' bg-third font-medium text-main'
          } else if (log) {
            classes += ' bg-amber-400/80 font-medium text-main'
          } else {
            classes += ' text-third/60'
          }
          if (isToday) classes += ' ring-1 ring-secondary'
          if (isSelected) classes += ' ring-2 ring-third'

          return (
            <button
              key={i}
              type="button"
              onClick={() => log && selectCell(log)}
              disabled={!log}
              className={classes}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      {selectedLog && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-secondary/25 px-3 py-2 text-sm">
          <div>
            <span className="text-third">{days[selectedLog.dayIndex]}</span>
            <span className="ml-2 text-xs text-third/60">
              {new Date(selectedLog.loggedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span
              className={
                selectedLog.completed ? 'ml-2 text-xs text-third/60' : 'ml-2 text-xs text-amber-400'
              }
            >
              {selectedLog.completed ? 'Done' : 'Skipped'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onRemove(selectedLog.id)
              setSelectedLogId(null)
            }}
            className="text-xs font-medium text-third/60 transition hover:text-red-400"
          >
            Remove
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-[10px] text-third/60">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-third" /> Done
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-amber-400/80" /> Skipped
        </span>
      </div>
    </div>
  )
}

export default TrainingCalendar
