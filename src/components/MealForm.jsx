import { useState } from 'react'
import { api } from '../lib/api'
import { useSubmit } from '../lib/useSubmit'

const emptyForm = { description: '', calories: '', proteinG: '', fatG: '', carbsG: '' }
const FIELD_LABELS = { proteinG: 'Protein (g)', fatG: 'Fat (g)', carbsG: 'Carbs (g)' }

function MealForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(emptyForm)

  const { submit, saving, error } = useSubmit(async () => {
    await api('/api/meals', {
      method: 'POST',
      body: JSON.stringify({
        description: form.description,
        calories: Number(form.calories),
        ...(form.proteinG ? { proteinG: Number(form.proteinG) } : {}),
        ...(form.fatG ? { fatG: Number(form.fatG) } : {}),
        ...(form.carbsG ? { carbsG: Number(form.carbsG) } : {}),
      }),
    })
    onSaved()
  }, 'Could not log that meal — please check the values and try again')

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Description</span>
        <input
          type="text"
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Chicken + rice"
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Calories</span>
        <input
          type="number"
          min="0"
          step="1"
          required
          value={form.calories}
          onChange={(e) => setForm({ ...form, calories: e.target.value })}
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        {['proteinG', 'fatG', 'carbsG'].map((field) => (
          <label key={field} className="flex flex-col gap-1 text-xs">
            <span className="text-third/60">{FIELD_LABELS[field]}</span>
            <input
              type="number"
              min="0"
              step="any"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              placeholder="0"
              className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
            />
          </label>
        ))}
      </div>

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

export default MealForm
