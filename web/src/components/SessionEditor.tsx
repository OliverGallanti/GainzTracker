import { useState } from 'react'
import { describeTiming } from '@gainz/shared/sessions'
import type { SplitLog, WorkoutSet } from '@gainz/shared/types'
import { api } from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { useSubmit } from '../lib/useSubmit'

// Form rows: every field is the input's text, numbers included. `kept` is what
// the form doesn't show (effort, the live timer's times, when it was done), so
// saving, which recreates every set, doesn't lose it.
type Kept = Pick<WorkoutSet, 'rpe' | 'durationSeconds' | 'restSeconds' | 'performedAt'>
type Row = { exerciseName: string; weightKg: string; reps: string; kept?: Kept }

const emptyRow = (): Row => ({ exerciseName: '', weightKg: '', reps: '' })

const toRows = (sets: WorkoutSet[]): Row[] =>
  sets.length > 0
    ? [...sets].reverse().map((s) => ({
        // the API lists newest first; the form shows them in the order done
        exerciseName: s.exerciseName,
        weightKg: s.weightKg == null ? '' : String(s.weightKg),
        reps: s.reps == null ? '' : String(s.reps),
        kept: { rpe: s.rpe, durationSeconds: s.durationSeconds, restSeconds: s.restSeconds, performedAt: s.performedAt },
      }))
    : [emptyRow()]

// Reused from both TrainingLogCard (right after marking a day done) and
// TrainingCalendar (editing a past day's session). `log` is the full
// SplitLog object the caller already has loaded — no dedicated
// "get one log" endpoint needed.
function SessionEditor({ log, onClose }: { log: SplitLog; onClose: () => void }) {
  const [durationMinutes, setDurationMinutes] = useState(log.durationMinutes == null ? '' : String(log.durationMinutes))

  // Saving is delete-then-recreate, so an editor that failed to read the
  // existing rows would wipe them on save. A failed load therefore blocks the
  // form entirely (see the render below) instead of showing a blank one.
  const existing = useLoad(['workoutSets', log.id], () => api<WorkoutSet[]>(`/api/workout-sets?splitLogId=${log.id}`))
  const loadError = existing.error

  // The rows are the server's rows until the user edits; from then on the
  // draft wins. Tagged with the log it belongs to so a different `log` prop
  // can never show a stale draft.
  const [draft, setDraft] = useState<{ forId: string; rows: Row[] } | null>(null)
  const loadedRows = existing.data ? toRows(existing.data) : null
  const rows = draft?.forId === log.id ? draft.rows : loadedRows
  const setRows = (next: Row[]) => setDraft({ forId: log.id, rows: next })

  // The form only renders once rows exist (a failed or pending load blocks it).
  const currentRows = rows ?? []

  const updateRow = (index: number, field: 'exerciseName' | 'weightKg' | 'reps', value: string) => {
    setRows(currentRows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  const removeRow = (index: number) => {
    setRows(currentRows.filter((_, i) => i !== index))
  }

  const addRow = () => {
    setRows([...currentRows, emptyRow()])
  }

  const { submit, saving, error } = useSubmit(async () => {
    // Delete-then-recreate rather than diffing: simpler. Each row carries its
    // set's other fields (see Row), so only the id changes.
    const existing = await api<WorkoutSet[]>(`/api/workout-sets?splitLogId=${log.id}`)
    await Promise.all(existing.map((s) => api(`/api/workout-sets/${s.id}`, { method: 'DELETE' })))

    const cleanedRows = currentRows.filter((r) => r.exerciseName.trim())
    await Promise.all(
      cleanedRows.map((r) =>
        api('/api/workout-sets', {
          method: 'POST',
          body: JSON.stringify({
            splitLogId: log.id,
            exerciseName: r.exerciseName.trim(),
            ...(r.weightKg ? { weightKg: Number(r.weightKg) } : {}),
            ...(r.reps ? { reps: Number(r.reps) } : {}),
            ...Object.fromEntries(Object.entries(r.kept ?? {}).filter(([, v]) => v != null)), // the API takes a missing field, not null
          }),
        }),
      ),
    )

    if (durationMinutes) {
      await api(`/api/workout-splits/${log.splitId}/logs/${log.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ durationMinutes: Number(durationMinutes) }),
      })
    }

    onClose()
  }, 'Could not save this session: please check the values and try again')

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-secondary/25 p-3"
    >
      {loadError ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-red-400">
            Could not load this session:{' '}
            <button type="button" onClick={existing.reload} className="underline hover:no-underline">
              retry
            </button>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-third/60 transition hover:text-third"
          >
            Close
          </button>
        </div>
      ) : rows === null ? (
        <p className="text-xs text-third/60">Loading…</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={row.exerciseName}
                  onChange={(e) => updateRow(index, 'exerciseName', e.target.value)}
                  placeholder="Exercise"
                  className="min-w-0 flex-1 rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-sm text-third outline-none focus:border-secondary"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={row.weightKg}
                  onChange={(e) => updateRow(index, 'weightKg', e.target.value)}
                  placeholder="kg"
                  className="w-16 rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-sm text-third outline-none focus:border-secondary"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={row.reps}
                  onChange={(e) => updateRow(index, 'reps', e.target.value)}
                  placeholder="reps"
                  className="w-16 rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-sm text-third outline-none focus:border-secondary"
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-third/60 hover:text-red-400"
                  aria-label="Remove exercise"
                >
                  ✕
                </button>
                {row.kept && describeTiming(row.kept) && <p className="w-full text-xs text-third/60">{describeTiming(row.kept)}</p>}
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="self-start text-xs font-medium text-third/60 transition hover:text-third"
            >
              + Add exercise
            </button>
          </div>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-third">Duration (minutes)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-20 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
            >
              {saving ? 'Saving…' : 'Save session'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </>
      )}
    </form>
  )
}

export default SessionEditor
