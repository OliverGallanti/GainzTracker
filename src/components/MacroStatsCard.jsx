import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { startOfLocalDay } from '../lib/dates'
import LifeBar from './LifeBar'

const emptyForm = { proteinG: '', fatG: '', carbsG: '', calorieTarget: '' }

function sumToday(meals) {
  return meals.reduce(
    (totals, meal) => ({
      proteinG: totals.proteinG + (meal.proteinG ?? 0),
      fatG: totals.fatG + (meal.fatG ?? 0),
      carbsG: totals.carbsG + (meal.carbsG ?? 0),
    }),
    { proteinG: 0, fatG: 0, carbsG: 0 },
  )
}

function MacroStatsCard() {
  const [goal, setGoal] = useState(undefined) // undefined = loading, null = unset
  const [todayTotals, setTodayTotals] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = () => {
    api('/api/macro-goal').then(setGoal)

    const since = startOfLocalDay().toISOString()
    api(`/api/meals?since=${encodeURIComponent(since)}`).then((meals) => {
      setTodayTotals(sumToday(meals))
    })
  }

  useEffect(() => {
    load()
  }, [])

  const startEditing = () => {
    setForm({
      proteinG: goal?.proteinG ?? '',
      fatG: goal?.fatG ?? '',
      carbsG: goal?.carbsG ?? '',
      calorieTarget: goal?.calorieTarget ?? '',
    })
    setError(null)
    setEditing(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api('/api/macro-goal', {
        method: 'PUT',
        body: JSON.stringify({
          proteinG: Number(form.proteinG),
          fatG: Number(form.fatG),
          carbsG: Number(form.carbsG),
          ...(form.calorieTarget ? { calorieTarget: Number(form.calorieTarget) } : {}),
        }),
      })
      setEditing(false)
      load()
    } catch {
      setError('Could not save your targets — please check the values and try again')
    } finally {
      setSaving(false)
    }
  }

  const isLoading = goal === undefined || todayTotals === null

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Today's macros</h2>
        {goal && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="text-xs font-medium text-neutral-400 transition hover:text-white"
          >
            Edit targets
          </button>
        )}
      </div>

      {isLoading && <p className="text-xs text-neutral-500">Loading…</p>}

      {!isLoading && !goal && !editing && (
        <div className="text-center">
          <p className="mb-3 text-xs text-neutral-500">
            Set your daily protein, fat, and carb targets to start tracking.
          </p>
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white active:scale-[0.98]"
          >
            Set your daily targets
          </button>
        </div>
      )}

      {!isLoading && goal && !editing && (
        <div className="flex flex-col gap-4">
          <LifeBar label="Protein" valueG={todayTotals.proteinG} targetG={goal.proteinG} />
          <LifeBar label="Fat" valueG={todayTotals.fatG} targetG={goal.fatG} />
          <LifeBar label="Carbs" valueG={todayTotals.carbsG} targetG={goal.carbsG} />
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          {['proteinG', 'fatG', 'carbsG'].map((field) => (
            <label key={field} className="flex items-center justify-between gap-3 text-sm">
              <span className="capitalize text-neutral-300">
                {field === 'proteinG' ? 'Protein (g)' : field === 'fatG' ? 'Fat (g)' : 'Carbs (g)'}
              </span>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-24 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-right text-white outline-none focus:border-neutral-500"
              />
            </label>
          ))}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-60 active:scale-[0.98]"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </form>
      )}
    </div>
  )
}

export default MacroStatsCard
