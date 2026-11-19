import { useState } from 'react'
import type { SplitLog } from '@gainz/shared/types'
import { uniqueDays } from '@gainz/shared/splits'
import { dayColor } from '@gainz/shared/dayColors'
import MonthGrid from './MonthGrid'
import SessionEditor from './SessionEditor'

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
  dayColors,
  selectedDate,
  onSelectDate,
  busy,
  onUpdate,
  onRemove,
  onSessionChange,
}: {
  logs: SplitLog[]
  days: string[]
  dayColors?: Record<string, string> | null
  selectedDate: Date
  onSelectDate: (date: Date | null) => void
} & LogActions) {
  // Enforced once-per-day server-side, so this map is always at most one log per key.
  const logsByDate = new Map<string, SplitLog>(logs.map((log) => [new Date(log.loggedAt).toDateString(), log]))
  const selectedLog = logsByDate.get(selectedDate.toDateString()) ?? null

  return (
    <div className="mt-5 border-t border-secondary/25 pt-4">
      <MonthGrid
        mark={(date) => {
          const log = logsByDate.get(date.toDateString())
          return log && { filled: log.completed, note: log.completed ? `${days[log.dayIndex]} done` : 'skipped', color: dayColor({ days, dayColors }, log.dayIndex) }
        }}
        selected={selectedDate}
        onSelect={onSelectDate}
      />

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
        {uniqueDays(days).map(({ label, index }) => {
          const color = dayColor({ days, dayColors }, index)
          return (
            color && (
              <span key={index} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: color }} /> {label}
              </span>
            )
          )
        })}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-amber-400/80" /> Skipped
        </span>
      </div>
    </div>
  )
}

export default TrainingCalendar
