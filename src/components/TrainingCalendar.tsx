import { useState } from 'react'
import type { SplitLog } from '../lib/types'
import { startOfLocalDay } from '../lib/dates'
import { uniqueDays } from '../lib/splits'
import SessionEditor from './SessionEditor'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Leading `null`s pad the grid so day 1 lands in the correct weekday column.
function buildMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const startOffset = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

// Details of one logged day. Keyed by log id at the call site, so the
// confirm-remove prompt and session editor never carry over to another log.
type LogActions = {
  busy: boolean
  onUpdate: (logId: string, changes: Partial<Pick<SplitLog, 'dayIndex' | 'completed'>>) => void
  onRemove: (logId: string) => void
  onSessionChange: () => void
}

function LogDetail({
  log,
  days,
  busy,
  onUpdate,
  onRemove,
  onSessionChange,
}: { log: SplitLog; days: string[] } & LogActions) {
  const [sessionEditorOpen, setSessionEditorOpen] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  return (
    <div className="mt-3 rounded-lg border border-secondary/25 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <select
            value={days.indexOf(days[log.dayIndex])}
            onChange={(e) => onUpdate(log.id, { dayIndex: Number(e.target.value) })}
            disabled={busy}
            aria-label="Training day"
            className="rounded-md border border-secondary/40 bg-main px-1.5 py-0.5 text-third outline-none focus:border-secondary"
          >
            {uniqueDays(days).map(({ label, index }) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-xs text-third/60">
            {new Date(log.loggedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <button
            type="button"
            onClick={() => onUpdate(log.id, { completed: !log.completed })}
            disabled={busy}
            title={log.completed ? 'Change to skipped' : 'Change to done'}
            className={`text-xs underline decoration-secondary/40 underline-offset-2 hover:decoration-secondary ${
              log.completed ? 'text-third/60' : 'text-amber-400'
            }`}
          >
            {log.completed ? 'Done' : 'Skipped'}
          </button>
          {log.durationMinutes && (
            <span className="text-xs text-third/60">{log.durationMinutes} min</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {log.completed && (
            <button
              type="button"
              onClick={() => setSessionEditorOpen((v) => !v)}
              className="text-xs font-medium text-third/60 transition hover:text-third"
            >
              {sessionEditorOpen ? 'Hide' : 'Log session'}
            </button>
          )}
          {!confirmingRemove && (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="text-xs font-medium text-third/60 transition hover:text-red-400"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {confirmingRemove && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-third/60">Remove this day and any exercises logged on it?</span>
          <button
            type="button"
            onClick={() => {
              onRemove(log.id)
              setConfirmingRemove(false)
              setSessionEditorOpen(false)
            }}
            className="font-medium text-red-400 hover:underline"
          >
            Yes, remove
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(false)}
            className="font-medium text-third/60 hover:text-third"
          >
            Cancel
          </button>
        </div>
      )}

      {sessionEditorOpen && (
        <SessionEditor
          log={log}
          onClose={() => {
            setSessionEditorOpen(false)
            onSessionChange()
          }}
        />
      )}
    </div>
  )
}

// Controlled: the card owns which day is selected (the logger above the calendar
// acts on it). Any past day or today can be picked; future days can't.
function TrainingCalendar({
  logs,
  days,
  selectedDate,
  onSelectDate,
  busy,
  onUpdate,
  onRemove,
  onSessionChange,
}: {
  logs: SplitLog[]
  days: string[]
  selectedDate: Date
  onSelectDate: (date: Date | null) => void
} & LogActions) {
  const today = new Date()
  const tomorrowStart = new Date(startOfLocalDay(today).getTime() + 24 * 60 * 60 * 1000)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  // Enforced once-per-day server-side, so this map is always at most one log per key.
  const logsByDate = new Map<string, SplitLog>(logs.map((log) => [new Date(log.loggedAt).toDateString(), log]))

  const cells = buildMonthGrid(viewDate)
  const isCurrentMonth =
    viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth()
  const selectedKey = selectedDate.toDateString()
  const selectedLog = logsByDate.get(selectedKey) ?? null

  // Today and re-clicking the selected day both mean "back to the default".
  const selectCell = (date: Date) => {
    const key = date.toDateString()
    onSelectDate(key === today.toDateString() || key === selectedKey ? null : date)
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
          const isSelected = date.toDateString() === selectedKey
          const selectable = date < tomorrowStart

          let classes = 'flex h-8 items-center justify-center rounded-lg text-xs transition'
          if (log?.completed) {
            classes += ' bg-third font-medium text-main'
          } else if (log) {
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
              className={classes}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      {selectedLog && (
        <LogDetail
          key={selectedLog.id}
          log={selectedLog}
          days={days}
          busy={busy}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onSessionChange={onSessionChange}
        />
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
