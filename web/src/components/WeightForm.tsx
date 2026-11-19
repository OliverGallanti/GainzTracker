import { useState } from 'react'
import { loggedAtOn } from '@gainz/shared/dates'
import type { WeightEntry } from '@gainz/shared/types'
import { api } from '../lib/api'
import { useSubmit } from '../lib/useSubmit'

// Logs a weigh-in on `day`, or edits `editing` (its day stays).
function WeightForm({ day, editing, onSaved, onCancel }: { day: Date; editing?: WeightEntry; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    weightKg: editing ? String(editing.weightKg) : '',
    bodyFatPercent: editing?.bodyFatPercent != null ? String(editing.bodyFatPercent) : '',
  })

  const { submit, saving, error } = useSubmit(async () => {
    const bodyFatPercent = form.bodyFatPercent ? Number(form.bodyFatPercent) : null
    if (editing) {
      await api(`/api/weights/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ weightKg: Number(form.weightKg), bodyFatPercent }) })
    } else {
      await api('/api/weights', {
        method: 'POST',
        body: JSON.stringify({
          weightKg: Number(form.weightKg),
          ...(bodyFatPercent != null ? { bodyFatPercent } : {}),
          loggedAt: loggedAtOn(day),
        }),
      })
    }
    onSaved()
  }, editing ? 'Could not save that change: please try again' : 'Could not log that weight: please check the values and try again')

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Weight (kg)</span>
        <input
          type="number"
          min="0"
          step="any"
          required
          value={form.weightKg}
          onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Body fat % (optional)</span>
        <input
          type="number"
          min="0"
          max="100"
          step="any"
          value={form.bodyFatPercent}
          onChange={(e) => setForm({ ...form, bodyFatPercent: e.target.value })}
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        />
      </label>

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </form>
  )
}

export default WeightForm
