import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { startOfLocalDay } from '../lib/dates'
import { computeAdherenceStreak, nextDayIndex } from '../lib/splits'
import TrainingCalendar from './TrainingCalendar'
import SessionEditor from './SessionEditor'

function todayBounds() {
  const dayStart = startOfLocalDay()
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  return { dayStart, dayEnd }
}

function TrainingLogCard({ refreshKey }) {
  const [split, setSplit] = useState(undefined) // undefined = loading, null = none active
  const [logs, setLogs] = useState(null)
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState(null)
  const [editingLog, setEditingLog] = useState(null)

  const load = () => {
    api('/api/workout-splits').then((splits) => {
      const active = splits.find((s) => s.active) ?? null
      setSplit(active)
      if (active) {
        api(`/api/workout-splits/${active.id}/logs`).then(setLogs)
      } else {
        setLogs(null)
      }
    })
  }

  useEffect(() => {
    load()
  }, [refreshKey])

  const handleLog = async (completed) => {
    setError(null)
    setLogging(true)
    try {
      const { dayStart, dayEnd } = todayBounds()
      const created = await api(`/api/workout-splits/${split.id}/logs`, {
        method: 'POST',
        body: JSON.stringify({ completed, dayStart, dayEnd }),
      })
      if (completed) setEditingLog(created)
      load()
    } catch {
      setError('Could not log that day — please try again')
    } finally {
      setLogging(false)
    }
  }

  const handleRemoveLog = async (logId) => {
    await api(`/api/workout-splits/${split.id}/logs/${logId}`, { method: 'DELETE' })
    load()
  }

  const isLoading = split === undefined || (split && logs === null)

  if (!isLoading && !split) {
    return (
      <div className="w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
        <h2 className="mb-1 text-sm font-semibold text-third">Training log</h2>
        <p className="text-xs text-third/60">Create a routine above to start logging your training days.</p>
      </div>
    )
  }

  const streak = logs ? computeAdherenceStreak(logs) : 0
  const dayIndex = split && logs ? nextDayIndex(split.days, logs) : 0
  const nextLabel = split ? split.days[dayIndex] : null

  const { dayStart, dayEnd } = todayBounds()
  const loggedToday =
    logs?.some((log) => {
      const loggedAt = new Date(log.loggedAt)
      return loggedAt >= dayStart && loggedAt < dayEnd
    }) ?? false

  return (
    <div className="w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <h2 className="mb-4 text-sm font-semibold text-third">Training log</h2>

      {isLoading && <p className="text-xs text-third/60">Loading…</p>}

      {!isLoading && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-third/60">
                Next up · day {dayIndex + 1} of {split.days.length}
              </p>
              <p className="text-lg font-semibold text-third">{nextLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-third">
                {streak}
                <span className="ml-1 text-sm font-normal text-third/60">
                  {streak === 1 ? 'day' : 'days'}
                </span>
              </p>
              <p className="text-xs text-third/60">streak</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleLog(true)}
              disabled={logging || loggedToday}
              className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
            >
              Mark done
            </button>
            <button
              type="button"
              onClick={() => handleLog(false)}
              disabled={logging || loggedToday}
              className="flex-1 rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary disabled:opacity-60 active:scale-[0.98]"
            >
              Mark skipped
            </button>
          </div>

          {loggedToday && (
            <p className="mt-2 text-center text-xs text-third/60">
              Already logged for today — remove it in the calendar below to change it.
            </p>
          )}

          {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}

          {editingLog && (
            <SessionEditor
              log={editingLog}
              onClose={() => {
                setEditingLog(null)
                load()
              }}
            />
          )}

          <TrainingCalendar logs={logs} days={split.days} onRemove={handleRemoveLog} onSessionChange={load} />
        </>
      )}
    </div>
  )
}

export default TrainingLogCard
