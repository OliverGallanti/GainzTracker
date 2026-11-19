import { useState } from 'react'
import type { SplitLog, WorkoutSplit } from '@gainz/shared/types'
import { routineOf, uniqueDays } from '@gainz/shared/splits'
import { dayColor } from '@gainz/shared/dayColors'
import MonthGrid from './MonthGrid'
import SessionEditor from './SessionEditor'

// Details of one logged day. Keyed by log id at the call site, so the
// confirm-remove prompt and session editor never carry over to another log.
type LogActions = {
  busy: boolean
  onUpdate: (log: SplitLog, changes: Partial<Pick<SplitLog, 'dayIndex' | 'completed'>>) => void
  onRemove: (log: SplitLog) => void
  onSessionChange: () => void
}

// `routine` is the log's own routine (an older one shows its name).
function LogDetail({
  log,
  routine,
  busy,
  onUpdate,
  onRemove,
  onSessionChange,
}: { log: SplitLog; routine: WorkoutSplit } & LogActions) {
  const { days } = routine
  const [sessionEditorOpen, setSessionEditorOpen] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  return (
    <div className="mt-3 rounded-lg border border-secondary/25 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <select
            value={days.indexOf(days[log.dayIndex])}
            onChange={(e) => onUpdate(log, { dayIndex: Number(e.target.value) })}
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
            {!routine.active && ` · ${routine.name}`}
          </span>
          <button
            type="button"
            onClick={() => onUpdate(log, { completed: !log.completed })}
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
              onRemove(log)
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
// acts on it). Any past day or today can be picked; future days can't. `logs`
// are every routine's, each drawn with its own routine's days and colours.
function TrainingCalendar({
  logs,
  splits,
  selectedDate,
  onSelectDate,
  busy,
  onUpdate,
  onRemove,
  onSessionChange,
}: {
  logs: SplitLog[]
  splits: WorkoutSplit[]
  selectedDate: Date
  onSelectDate: (date: Date | null) => void
} & LogActions) {
  // Enforced once-per-day server-side, so this map is always at most one log per key.
  const logsByDate = new Map<string, SplitLog>(logs.map((log) => [new Date(log.loggedAt).toDateString(), log]))
  const selectedLog = logsByDate.get(selectedDate.toDateString()) ?? null
  const selectedRoutine = selectedLog ? routineOf(splits, selectedLog) : undefined
  const active = splits.find((s) => s.active)

  return (
    <div className="mt-5 border-t border-secondary/25 pt-4">
      <MonthGrid
        mark={(date) => {
          const log = logsByDate.get(date.toDateString())
          const routine = log && routineOf(splits, log)
          return log && routine && { filled: log.completed, note: log.completed ? `${routine.days[log.dayIndex]} done` : 'skipped', color: dayColor(routine, log.dayIndex) }
        }}
        selected={selectedDate}
        onSelect={onSelectDate}
      />

      {selectedLog && selectedRoutine && (
        <LogDetail
          key={selectedLog.id}
          log={selectedLog}
          routine={selectedRoutine}
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
        {active && uniqueDays(active.days).map(({ label, index }) => {
          const color = dayColor(active, index)
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
