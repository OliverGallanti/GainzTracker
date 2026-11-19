import { useEffect, useRef, useState } from 'react'
import type { SplitLog, WorkoutSplit } from '@gainz/shared/types'
import { Check, Pencil, Repeat } from 'lucide-react'
import { colorFor, dayColorKey, dayIcon, withDayStyle, type DayColor, type DayIcon } from '@gainz/shared/dayColors'
import { api } from '../lib/api'
import { startOfLocalDay } from '@gainz/shared/dates'
import { computeWeeklyStreak, logOnDay, suggestedDayIndex, uniqueDays, weeklyGoal } from '@gainz/shared/splits'
import { useLoad } from '../lib/useLoad'
import { useSubmit } from '../lib/useSubmit'
import DayLogForm from './DayLogForm'
import TrainingCalendar from './TrainingCalendar'
import { DayPill, DayStylePicker } from './DayStyle'
import SessionEditor from './SessionEditor'
import RoutineEditor from './RoutineEditor'

// Routine (which split you follow) and training log (did you follow it) live in
// one card: the log is meaningless without the routine, and the routine alone
// is only a name and a list of days.
function TrainingLogCard() {
  const [editingLog, setEditingLog] = useState<SplitLog | null>(null)
  const [editingRoutine, setEditingRoutine] = useState<'new' | 'edit' | null>(null) // a new routine, or an edit of the current one
  const [styling, setStyling] = useState<string | null>(null) // the day name whose picker is open

  // The day the logger below acts on. null = today; the calendar sets it when a
  // past day is picked, and a click anywhere outside this card puts it back.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selectedDate) return
    const onOutsideClick = (e: MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) setSelectedDate(null)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [selectedDate])

  // Every routine and every log. The calendar and the streak use all of them
  // (each log with its own routine's days), so switching routines never makes
  // the past look empty or resets the streak. Logging uses the active routine.
  const { data, error: loadError, reload } = useLoad(['training'], async () => {
    const [splits, logs] = await Promise.all([api<WorkoutSplit[]>('/api/workout-splits'), api<SplitLog[]>('/api/workout-splits/logs')])
    return { splits, split: splits.find((s) => s.active) ?? null, logs }
  })

  const splits = data?.splits ?? []
  const split = data?.split // undefined = loading, null = none active
  const logs = data?.logs ?? null
  const ownLogs = split && logs ? logs.filter((l) => l.splitId === split.id) : []
  const pastSplits = splits.filter((s) => !s.active)

  // Every change to a log goes through here, so they all disable the controls
  // while in flight and report a failure instead of failing silently.
  const { submit: mutate, saving: busy, error } = useSubmit(async (change: () => Promise<unknown>) => {
    await change()
    reload()
  }, 'Could not save that change: please try again')

  // Only reachable while a routine is active (the controls render only then).
  const splitUrl = (path = '') => {
    if (!split) throw new Error('No active routine')
    return `/api/workout-splits/${split.id}${path}`
  }

  // `date` is the calendar day being logged: today, or a past day being filled in.
  const logDay = (date: Date, dayIndex: number, completed: boolean) =>
    mutate(async () => {
      const dayStart = startOfLocalDay(date)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      const isToday = date.toDateString() === new Date().toDateString()
      const noon = new Date(dayStart.getTime() + 12 * 60 * 60 * 1000)
      const created = await api<SplitLog>(splitUrl('/logs'), {
        method: 'POST',
        body: JSON.stringify({
          completed,
          dayIndex,
          dayStart,
          dayEnd,
          loggedAt: isToday ? new Date() : noon,
        }),
      })
      if (completed) setEditingLog(created)
    })

  // By the log's own routine: it may be an older one.
  const logUrl = (log: SplitLog) => `/api/workout-splits/${log.splitId}/logs/${log.id}`
  const updateLog = (log: SplitLog, changes: Partial<Pick<SplitLog, 'dayIndex' | 'completed'>>) =>
    mutate(() => api(logUrl(log), { method: 'PATCH', body: JSON.stringify(changes) }))

  const removeLog = (log: SplitLog) => mutate(() => api(logUrl(log), { method: 'DELETE' }))

  const changeWeeklyGoal = (daysPerWeek: number) =>
    mutate(() =>
      api(splitUrl(), { method: 'PATCH', body: JSON.stringify({ daysPerWeek }) }),
    )

  const changeDayStyle = (day: string, color: DayColor | null, icon: DayIcon | null) =>
    split && mutate(() => api(splitUrl(), { method: 'PATCH', body: JSON.stringify(withDayStyle(split, day, color, icon)) }))

  // Removing a past routine deletes its training days too (they belong to it).
  const handleDeleteSplit = async (s: WorkoutSplit) => {
    const count = logs?.filter((l) => l.splitId === s.id).length ?? 0
    if (count > 0 && !window.confirm(`Remove "${s.name}" and its ${count} training ${count === 1 ? 'day' : 'days'}? This can't be undone.`)) return
    await api(`/api/workout-splits/${s.id}`, { method: 'DELETE' })
    reload()
  }

  const handleRoutineSaved = () => {
    setEditingRoutine(null)
    reload()
  }

  const isLoading = data === undefined
  const showLog = !isLoading && !editingRoutine && split

  const goal = split ? weeklyGoal(split) : 1
  const { streak, thisWeekDays } = computeWeeklyStreak(logs ?? [], goal)
  const goalMet = thisWeekDays >= goal
  const suggestedIndex = split ? suggestedDayIndex(split.days, ownLogs) : 0

  const target = selectedDate ?? new Date()
  const targetIsToday = !selectedDate
  const targetLogged = !!logs && logOnDay(logs, target) !== undefined

  return (
    <div ref={cardRef} className="glow-card w-full md:col-span-2 xl:col-span-1 rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="card-title">Training log</h2>
        {showLog && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditingRoutine('edit')} className="btn btn-secondary">
              <Pencil size={14} />
              Edit routine
            </button>
            <button type="button" onClick={() => setEditingRoutine('new')} title="Starts a new routine; your history stays" className="btn btn-secondary">
              <Repeat size={14} />
              New routine
            </button>
          </div>
        )}
      </div>

      {isLoading && !loadError && <p className="text-xs text-third/60">Loading…</p>}

      {loadError && (
        <p className="text-xs text-red-400">
          Could not load your training log:{' '}
          <button type="button" onClick={reload} className="underline hover:no-underline">
            retry
          </button>
        </p>
      )}

      {!isLoading && editingRoutine && (
        <RoutineEditor
          editing={editingRoutine === 'edit' && split ? split : undefined}
          loggedDays={new Set(ownLogs.map((l) => l.dayIndex))}
          onSaved={handleRoutineSaved}
          onCancel={() => setEditingRoutine(null)}
        />
      )}

      {!isLoading && !editingRoutine && !split && (
        <div className="text-center">
          <p className="mb-3 text-xs text-third/60">
            Create a routine to start tracking your training streak.
          </p>
          <button
            type="button"
            onClick={() => setEditingRoutine('new')}
            className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
          >
            Create a routine
          </button>
        </div>
      )}

      {showLog && (
        <>
          <p className="text-xs font-medium text-third">{split.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {uniqueDays(split.days).map(({ label, index }) => (
              <DayPill
                key={index}
                name={label}
                color={colorFor(dayColorKey(split, label))}
                icon={dayIcon(split, label)}
                active={styling === label}
                onClick={() => setStyling(styling === label ? null : label)}
              />
            ))}
          </div>
          {styling ? (
            <div className="mt-2">
              <DayStylePicker
                color={dayColorKey(split, styling)}
                icon={dayIcon(split, styling)}
                disabled={busy}
                onChange={(color, icon) => changeDayStyle(styling, color, icon)}
              />
            </div>
          ) : (
            <p className="mt-1 text-[10px] text-third/60">Click a day to give it a colour and an icon.</p>
          )}
          <label className="mt-2 mb-4 flex items-center gap-2 text-xs text-third/60">
            Weekly goal
            <select
              value={goal}
              onChange={(e) => changeWeeklyGoal(Number(e.target.value))}
              disabled={busy}
              className="rounded-md border border-secondary/40 bg-main px-1.5 py-0.5 text-third outline-none focus:border-secondary"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'day' : 'days'}
                </option>
              ))}
            </select>
            a week
          </label>

          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-third/60">
              {targetIsToday
                ? 'What are you training today?'
                : `What did you train on ${target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}?`}
            </p>
            <div className="text-right">
              <p className="text-2xl font-bold text-third">
                {streak}
                <span className="ml-1 text-sm font-normal text-third/60">
                  {streak === 1 ? 'week' : 'weeks'}
                </span>
              </p>
              <p className="text-xs text-third/60">streak</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-xs text-third/60">
                {goalMet && <Check size={12} className="text-third" />}
                {thisWeekDays} of {goal} this week
              </p>
            </div>
          </div>

          <DayLogForm
            split={split}
            suggestedIndex={suggestedIndex}
            disabled={busy || targetLogged}
            onLog={(dayIndex, completed) => logDay(target, dayIndex, completed)}
          />

          {targetLogged && (
            <p className="mt-2 text-center text-xs text-third/60">
              Already logged for {targetIsToday ? 'today' : 'that day'} — change it in the calendar below.
            </p>
          )}

          {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}

          {editingLog && (
            <SessionEditor
              log={editingLog}
              onClose={() => {
                setEditingLog(null)
                reload()
              }}
            />
          )}

          <TrainingCalendar
            logs={logs ?? []}
            splits={splits}
            selectedDate={target}
            onSelectDate={setSelectedDate}
            busy={busy}
            onUpdate={updateLog}
            onRemove={removeLog}
            onSessionChange={reload}
          />
        </>
      )}

      {!isLoading && !editingRoutine && pastSplits.length > 0 && (
        <div className="mt-4 border-t border-secondary/25 pt-3">
          <p className="mb-2 text-xs text-third/60">Past routines</p>
          <ul className="flex flex-col gap-2">
            {pastSplits.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-secondary/25 px-3 py-2 text-sm"
              >
                <span className="text-third/60">{s.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteSplit(s)}
                  className="text-xs font-medium text-third/60 transition hover:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default TrainingLogCard
