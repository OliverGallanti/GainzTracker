import { useState } from 'react'
import { api } from '../lib/api'
import { useSubmit } from '../lib/useSubmit'

function WeightGoalsForm({ weightGoal, bodyFatGoal, onSaved, onCancel }) {
  const [form, setForm] = useState({
    weightGoalKg: weightGoal ?? '',
    bodyFatGoalPercent: bodyFatGoal ?? '',
  })

  const { submit, saving, error } = useSubmit(async () => {
    // Note: an emptied field is omitted rather than nulled, so a goal can be
    // changed but not cleared. Pre-existing behavior, preserved deliberately.
    await api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({
        ...(form.weightGoalKg ? { weightGoalKg: Number(form.weightGoalKg) } : {}),
        ...(form.bodyFatGoalPercent ? { bodyFatGoalPercent: Number(form.bodyFatGoalPercent) } : {}),
      }),
    })
    onSaved()
  }, 'Could not save your goals — please check the values and try again')

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-third">Weight goal (kg)</span>
        <input
          type="number"
          min="1"
          step="any"
          value={form.weightGoalKg}
          onChange={(e) => setForm({ ...form, weightGoalKg: e.target.value })}
          className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-third">Body fat goal (%)</span>
        <input
          type="number"
          min="0"
          max="100"
          step="any"
          value={form.bodyFatGoalPercent}
          onChange={(e) => setForm({ ...form, bodyFatGoalPercent: e.target.value })}
          className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
        />
      </label>

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : 'Save'}
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

export default WeightGoalsForm
