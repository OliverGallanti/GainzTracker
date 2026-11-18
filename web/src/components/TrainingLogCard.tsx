import { useEffect, useRef, useState } from 'react'
import type { SplitLog, WorkoutSplit } from '@gainz/shared/types'
import { Check, Repeat } from 'lucide-react'
import { api } from '../lib/api'
import { startOfLocalDay } from '@gainz/shared/dates'
import { computeWeeklyStreak, logOnDay, suggestedDayIndex, weeklyGoal } from '@gainz/shared/splits'
import { useLoad } from '../lib/useLoad'
import { useSubmit } from '../lib/useSubmit'
import DayLogForm from './DayLogForm'
import TrainingCalendar from './TrainingCalendar'
import SessionEditor from './SessionEditor'
import RoutineEditor from './RoutineEditor'

// Routine (which split you follow) and training log (did you follow it) live in
// one card: the log is meaningless without the routine, and the routine alone
// is only a name and a list of days.
function TrainingLogCard() {
  const [editingLog, setEditingLog] = useState<SplitLog | null>(null)
  const [editingRoutine, setEditingRoutine] = useState(false)

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

  // The logs depend on which split is active, so this is one dependent load. The
  // weekly streak counts days across every routine (switching routine mid-week
  // shouldn't wipe it), so all splits' logs are fetched; the calendar and day
  // logger only use the active split's.
  const { data, error: loadError, reload } = useLoad(['training'], async () => {
    const [splits, allLogs] = await Promise.all([api<WorkoutSplit[]>('/api/workout-splits'), api<SplitLog[]>('/api/workout-splits/logs')])
    const split = splits.find((s) => s.active) ?? null
    return { splits, split, logs: split ? allLogs.filter((log) => log.splitId === split.id) : null, allLogs }
  })

  const splits = data?.splits ?? []
  const split = data?.split // undefined = loading, null = none active
  const logs = data?.logs ?? null
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

  const updateLog = (logId: string, changes: Partial<Pick<SplitLog, 'dayIndex' | 'completed'>>) =>
    mutate(() =>
      api(splitUrl(`/logs/${logId}`), {
        method: 'PATCH',
        body: JSON.stringify(changes),
      }),
    )

  const removeLog = (logId: string) =>
    mutate(() => api(splitUrl(`/logs/${logId}`), { method: 'DELETE' }))

  const changeWeeklyGoal = (daysPerWeek: number) =>
    mutate(() =>
      api(splitUrl(), { method: 'PATCH', body: JSON.stringify({ daysPerWeek }) }),
    )

  const handleDeleteSplit = async (id: string) => {
    await api(`/api/workout-splits/${id}`, { method: 'DELETE' })
    reload()
  }

  const handleRoutineSaved = () => {
    setEditingRoutine(false)
    reload()
  }

  const isLoading = data === undefined
  const showLog = !isLoading && !editingRoutine && split

  const goal = split ? weeklyGoal(split) : 1
  const { streak, thisWeekDays } = computeWeeklyStreak(data?.allLogs ?? [], goal)
  const goalMet = thisWeekDays >= goal
  const suggestedIndex = split && logs ? suggestedDayIndex(split.days, logs) : 0

  const target = selectedDate ?? new Date()
  const targetIsToday = !selectedDate
  const targetLogged = !!logs && logOnDay(logs, target) !== undefined

  return (
    <div ref={cardRef} className="glow-card w-full md:col-span-2 xl:col-span-1 rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="card-title">Training log</h2>
        {showLog && (
          <button
            type="button"
            onClick={() => setEditingRoutine(true)}
            className="btn btn-secondary"
          >
            <Repeat size={14} />
            Change routine
          </button>
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
        <RoutineEditor onSaved={handleRoutineSaved} onCancel={() => setEditingRoutine(false)} />
      )}

      {!isLoading && !editingRoutine && !split && (
        <div className="text-center">
          <p className="mb-3 text-xs text-third/60">
            Create a routine to start tracking your training streak.
          </p>
          <button
            type="button"
            onClick={() => setEditingRoutine(true)}
            className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
          >
            Create a routine
          </button>
        </div>
      )}

      {showLog && (
        <>
          <p className="text-xs text-third/60">
            <span className="font-medium text-third">{split.name}</span> · {split.days.join(' → ')}
          </p>
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
            days={split.days}
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
            days={split.days}
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
                  onClick={() => handleDeleteSplit(s.id)}
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
