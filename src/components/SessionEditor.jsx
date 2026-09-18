import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const emptyRow = () => ({ exerciseName: '', weightKg: '', reps: '' })

// Reused from both TrainingLogCard (right after marking a day done) and
// TrainingCalendar (editing a past day's session). `log` is the full
// SplitLog object the caller already has loaded — no dedicated
// "get one log" endpoint needed.
function SessionEditor({ log, onClose }) {
  const [rows, setRows] = useState(null) // null = loading
  const [durationMinutes, setDurationMinutes] = useState(log.durationMinutes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api(`/api/workout-sets?splitLogId=${log.id}`).then((sets) => {
      setRows(
        sets.length > 0
          ? sets.map((s) => ({
              id: s.id,
              exerciseName: s.exerciseName,
              weightKg: s.weightKg ?? '',
              reps: s.reps ?? '',
            }))
          : [emptyRow()],
      )
    })
  }, [log.id])

  const updateRow = (index, field, value) => {
    setRows(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const addRow = () => {
    setRows([...rows, emptyRow()])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // Delete-then-recreate rather than diffing — simpler, and these sets
      // are only ever queried by splitLogId, never by their own timestamp,
      // so resetting performedAt/id on every save costs nothing here.
      const existing = await api(`/api/workout-sets?splitLogId=${log.id}`)
      await Promise.all(existing.map((s) => api(`/api/workout-sets/${s.id}`, { method: 'DELETE' })))

      const cleanedRows = rows.filter((r) => r.exerciseName.trim())
      await Promise.all(
        cleanedRows.map((r) =>
          api('/api/workout-sets', {
            method: 'POST',
            body: JSON.stringify({
              splitLogId: log.id,
              exerciseName: r.exerciseName.trim(),
              ...(r.weightKg ? { weightKg: Number(r.weightKg) } : {}),
              ...(r.reps ? { reps: Number(r.reps) } : {}),
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
    } catch {
      setError('Could not save this session — please check the values and try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-secondary/25 p-3"
    >
      {rows === null ? (
        <p className="text-xs text-third/60">Loading…</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
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
