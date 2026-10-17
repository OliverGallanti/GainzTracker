import { useState } from 'react'
import { api } from '../lib/api'
import { BIG_FOUR_LIFTS } from '../lib/lifts'
import { useSubmit } from '../lib/useSubmit'

function BigFourLiftForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ exerciseName: BIG_FOUR_LIFTS[0], weightKg: '', reps: '' })

  const { submit, saving, error } = useSubmit(async () => {
    await api('/api/workout-sets', {
      method: 'POST',
      body: JSON.stringify({
        exerciseName: form.exerciseName,
        weightKg: Number(form.weightKg),
        ...(form.reps ? { reps: Number(form.reps) } : {}),
      }),
    })
    onSaved()
  }, 'Could not log that lift: please check the values and try again')

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Lift</span>
        <select
          value={form.exerciseName}
          onChange={(e) => setForm({ ...form, exerciseName: e.target.value })}
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        >
          {BIG_FOUR_LIFTS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

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
        <span className="text-third">Reps (optional)</span>
        <input
          type="number"
          min="1"
          step="1"
          value={form.reps}
          onChange={(e) => setForm({ ...form, reps: e.target.value })}
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        />
      </label>

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : 'Add'}
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

export default BigFourLiftForm
