import { useState } from 'react'
import { api } from '../lib/api'
import { useSubmit } from '../lib/useSubmit'

const TDEE_GOALS = [
  { label: 'Cut', delta: -500 },
  { label: 'Maintain', delta: 0 },
  { label: 'Bulk', delta: 300 },
]

const FIELD_LABELS = { proteinG: 'Protein (g)', fatG: 'Fat (g)', carbsG: 'Carbs (g)' }

// Owns its own draft state: it only mounts when the card enters edit mode, so
// seeding from `goal` at mount reproduces the old "startEditTargets" behavior.
function MacroTargetsForm({ goal, tdee, onSaved, onCancel }) {
  const [form, setForm] = useState({
    proteinG: goal?.proteinG ?? '',
    fatG: goal?.fatG ?? '',
    carbsG: goal?.carbsG ?? '',
    calorieTarget: goal?.calorieTarget ?? '',
  })
  // A saved calorieTarget is treated as a deliberate value, not a stale
  // suggestion — only start auto-computing once the macros actually change.
  const [calorieTargetTouched, setCalorieTargetTouched] = useState(Boolean(goal?.calorieTarget))

  const { submit, saving, error } = useSubmit(async () => {
    await api('/api/macro-goal', {
      method: 'PUT',
      body: JSON.stringify({
        proteinG: Number(form.proteinG),
        fatG: Number(form.fatG),
        carbsG: Number(form.carbsG),
        ...(form.calorieTarget ? { calorieTarget: Number(form.calorieTarget) } : {}),
      }),
    })
    onSaved()
  }, 'Could not save your targets: please check the values and try again')

  // Atwater factors (4 kcal/g protein & carbs, 9 kcal/g fat) — a live
  // suggestion, not a lock: it keeps recomputing until the calorie field
  // itself is edited, at which point it becomes a deliberate override.
  const updateField = (field, rawValue) => {
    const next = { ...form, [field]: rawValue }
    if (!calorieTargetTouched) {
      const p = Number(next.proteinG) || 0
      const f = Number(next.fatG) || 0
      const c = Number(next.carbsG) || 0
      next.calorieTarget = p || f || c ? String(Math.round(p * 4 + f * 9 + c * 4)) : ''
    }
    setForm(next)
  }

  const applyTdeeGoal = (delta) => {
    setCalorieTargetTouched(true)
    setForm((f) => ({ ...f, calorieTarget: String(tdee + delta) }))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {['proteinG', 'fatG', 'carbsG'].map((field) => (
        <label key={field} className="flex items-center justify-between gap-3 text-sm">
          <span className="capitalize text-third">{FIELD_LABELS[field]}</span>
          <input
            type="number"
            min="1"
            step="any"
            required
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
          />
        </label>
      ))}

      <div className="border-t border-secondary/25 pt-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-third">Total calories (optional)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.calorieTarget}
            onChange={(e) => {
              setCalorieTargetTouched(true)
              setForm({ ...form, calorieTarget: e.target.value })
            }}
            className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
          />
        </label>
        {!calorieTargetTouched && form.calorieTarget && (
          <p className="mt-1 text-right text-xs text-third/60">
            Auto-calculated from protein/fat/carbs: edit to override
          </p>
        )}
      </div>

      <div className="border-t border-secondary/25 pt-3">
        <p className="text-xs font-medium text-third">TDEE calculator</p>
        {tdee == null ? (
          <p className="mt-1 text-xs text-third/60">
            Set your sex, age, and activity level in Profile &amp; security, and log your weight and
            height, to estimate your calories.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-third/60">
              Estimated maintenance: <span className="text-third">{tdee} cal/day</span>
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TDEE_GOALS.map(({ label, delta }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => applyTdeeGoal(delta)}
                  className="rounded-lg border border-secondary/40 px-2 py-1.5 text-center text-xs text-third transition hover:border-secondary active:scale-[0.98]"
                >
                  <span className="block font-medium">{label}</span>
                  <span className="block text-third/60">{tdee + delta} cal</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-third/60">
              Estimate only (Mifflin-St Jeor) — not medical advice. Adjust based on real-world
              results.
            </p>
          </>
        )}
      </div>

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

export default MacroTargetsForm
