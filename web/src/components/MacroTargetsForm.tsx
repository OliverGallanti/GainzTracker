import { useState } from 'react'
import type { MacroGoal, Sex } from '@gainz/shared/types'
import { api } from '../lib/api'
import { ADULT_AGE, PROTEIN_RANGE_TEXT, suggestMacros, tdeePresets, type Goal } from '@gainz/shared/macroSplit'
import { useSubmit } from '../lib/useSubmit'

const FIELD_LABELS = { proteinG: 'Protein (g)', fatG: 'Fat (g)', carbsG: 'Carbs (g)' }

// Owns its own draft state: it only mounts when the card enters edit mode, so
// seeding from `goal` at mount reproduces the old "startEditTargets" behavior.
// Reads top to bottom in the order a newcomer needs things: how many calories,
// then how to split them.
function MacroTargetsForm({
  goal,
  tdee,
  bodyweight,
  sex,
  age,
  onSaved,
  onCancel,
}: {
  goal: MacroGoal | null | undefined
  tdee: number | null
  bodyweight: number | null
  sex: Sex | null | undefined
  age: number | null | undefined
  onSaved: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    proteinG: goal?.proteinG ?? '',
    fatG: goal?.fatG ?? '',
    carbsG: goal?.carbsG ?? '',
    calorieTarget: goal?.calorieTarget ?? '',
  })
  // A saved calorieTarget is treated as a deliberate value, not a stale
  // suggestion — only start auto-computing once the macros actually change.
  const [calorieTargetTouched, setCalorieTargetTouched] = useState(Boolean(goal?.calorieTarget))
  const [presetKey, setPresetKey] = useState<Goal>('maintain') // the last calorie preset chosen; picks the protein level
  const [suggested, setSuggested] = useState<{ proteinPerKg: number; weightKg: number } | null>(null) // what the last suggestion was based on, to explain it

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
  const updateField = (field: keyof typeof form, rawValue: string) => {
    const next = { ...form, [field]: rawValue }
    if (!calorieTargetTouched) {
      const p = Number(next.proteinG) || 0
      const f = Number(next.fatG) || 0
      const c = Number(next.carbsG) || 0
      next.calorieTarget = p || f || c ? String(Math.round(p * 4 + f * 9 + c * 4)) : ''
    }
    setForm(next)
  }

  const applyPreset = (preset: { key: Goal; calories: number }) => {
    setCalorieTargetTouched(true)
    setPresetKey(preset.key)
    setForm((f) => ({ ...f, calorieTarget: String(preset.calories) }))
  }

  const isMinor = age != null && age < ADULT_AGE
  const presets = tdee == null ? [] : tdeePresets(tdee, sex, age)
  const calories = Number(form.calorieTarget)
  const canSuggest = !isMinor && bodyweight != null && calories > 0

  // Fills the fields; nothing is saved until the user presses Save.
  const applySuggestion = () => {
    const split = suggestMacros({ calories, weightKg: bodyweight, goal: presetKey })
    if (!split || bodyweight == null) return
    setCalorieTargetTouched(true)
    setForm({
      ...form,
      proteinG: String(split.proteinG),
      fatG: String(split.fatG),
      carbsG: String(split.carbsG),
    })
    setSuggested({ proteinPerKg: split.proteinPerKg, weightKg: bodyweight })
  }

  const suggestHint = isMinor
    ? 'Suggestions are for adults. If you are under 18, ask a doctor or dietitian for targets.'
    : bodyweight == null
      ? 'Log your weight to get a suggestion.'
      : !(calories > 0)
        ? 'Choose or enter a calorie target first.'
        : null

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium text-third">1. Daily calories</p>
        {tdee == null ? (
          <p className="mt-1 text-xs text-third/60">
            Set your sex, age, and activity level in Profile &amp; security, and log your weight and
            height, to get a calorie estimate. Or enter a target yourself below.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-third/60">
              Estimated maintenance: <span className="text-third">{tdee} cal/day</span>
            </p>
            <div className={`mt-2 grid gap-2 ${presets.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  disabled={!preset.available}
                  className="rounded-lg border border-secondary/40 px-2 py-1.5 text-center text-xs text-third transition hover:border-secondary active:scale-[0.98] disabled:opacity-40"
                >
                  <span className="block font-medium">{preset.label}</span>
                  <span className="block text-third/60">
                    {preset.available ? `${preset.calories} cal` : 'not advised'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <label className="mt-3 flex items-center justify-between gap-3 text-sm">
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
        <p className="text-xs font-medium text-third">2. Protein, fat and carbs</p>
        <p className="mt-1 text-xs text-third/60">
          1 g of protein = 4 cal, 1 g of carbs = 4 cal, 1 g of fat = 9 cal. A common protein range for
          people who lift is {PROTEIN_RANGE_TEXT}, toward the higher end when cutting.
        </p>

        <button
          type="button"
          onClick={applySuggestion}
          disabled={!canSuggest}
          className="mt-2 w-full rounded-lg border border-secondary/40 px-3 py-2 text-xs font-medium text-third transition hover:border-secondary active:scale-[0.98] disabled:opacity-40"
        >
          Suggest protein, fat and carbs
        </button>
        {suggestHint && <p className="mt-1 text-xs text-third/60">{suggestHint}</p>}
        {suggested && (
          <p role="status" className="mt-1 text-xs text-third/60">
            Filled in: protein {suggested.proteinPerKg} g per kg of your {suggested.weightKg} kg, fat about
            25% of calories, and carbs for the rest. Change any of it before saving.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {(['proteinG', 'fatG', 'carbsG'] as const).map((field) => (
            <label key={field} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-third">{FIELD_LABELS[field]}</span>
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
        </div>
      </div>

      <p className="text-[11px] leading-snug text-third/60">
        General guidance for healthy adults, not medical advice. Calorie estimate uses the Mifflin-St Jeor
        formula; adjust based on real-world results. If you are pregnant, have a medical condition, or have a
        history of disordered eating, talk to a doctor or dietitian first.
      </p>

      <div className="flex gap-2">
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
