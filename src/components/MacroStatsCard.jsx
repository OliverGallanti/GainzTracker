import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { startOfLocalDay } from '../lib/dates'
import { computeBmr, computeTdee } from '../lib/tdee'
import LifeBar from './LifeBar'

const TDEE_GOALS = [
  { label: 'Cut', delta: -500 },
  { label: 'Maintain', delta: 0 },
  { label: 'Bulk', delta: 300 },
]

const emptyTargetForm = { proteinG: '', fatG: '', carbsG: '', calorieTarget: '' }
const emptyMealForm = { description: '', calories: '', proteinG: '', fatG: '', carbsG: '' }

function sumToday(meals) {
  return meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + meal.calories,
      proteinG: totals.proteinG + (meal.proteinG ?? 0),
      fatG: totals.fatG + (meal.fatG ?? 0),
      carbsG: totals.carbsG + (meal.carbsG ?? 0),
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  )
}

const UNITS = [
  { key: 'g', label: 'g' },
  { key: 'cal', label: 'Cal' },
  { key: 'percent', label: '%' },
]

// null when a meal didn't log that macro, rather than "0g" implying it was measured.
function formatMacro(value, unit) {
  return value == null ? null : `${Math.round(value)}${unit}`
}

function MacroStatsCard() {
  const [goal, setGoal] = useState(undefined) // undefined = loading, null = unset
  const [meals, setMeals] = useState(undefined) // undefined = loading
  const [mode, setMode] = useState('view') // 'view' | 'editTargets' | 'logFood'
  const [unit, setUnit] = useState('g') // 'g' | 'cal' | 'percent' — display only, never affects fill

  // Only fetched for the TDEE calculator inside the targets form — nothing
  // else on this card needs a bodyweight or profile.
  const [bodyweight, setBodyweight] = useState(undefined) // undefined = loading, null = none logged
  const [tdeeProfile, setTdeeProfile] = useState(undefined)

  const [targetForm, setTargetForm] = useState(emptyTargetForm)
  const [calorieTargetTouched, setCalorieTargetTouched] = useState(false)
  const [savingTarget, setSavingTarget] = useState(false)
  const [targetError, setTargetError] = useState(null)

  const [mealForm, setMealForm] = useState(emptyMealForm)
  const [savingMeal, setSavingMeal] = useState(false)
  const [mealError, setMealError] = useState(null)

  const load = () => {
    api('/api/macro-goal').then(setGoal)

    const since = startOfLocalDay().toISOString()
    api(`/api/meals?since=${encodeURIComponent(since)}`).then(setMeals)

    api('/api/me').then((me) =>
      setTdeeProfile({ heightCm: me.heightCm, sex: me.sex, age: me.age, activityLevel: me.activityLevel }),
    )
    // Already sorted loggedAt desc by the API, so [0] is the latest weigh-in.
    api('/api/weights').then((data) => setBodyweight(data.length ? data[0].weightKg : null))
  }

  useEffect(() => {
    load()
  }, [])

  const startEditTargets = () => {
    setTargetForm({
      proteinG: goal?.proteinG ?? '',
      fatG: goal?.fatG ?? '',
      carbsG: goal?.carbsG ?? '',
      calorieTarget: goal?.calorieTarget ?? '',
    })
    // A saved calorieTarget is treated as a deliberate value, not a stale
    // suggestion — only start auto-computing once the macros actually change.
    setCalorieTargetTouched(Boolean(goal?.calorieTarget))
    setTargetError(null)
    setMode('editTargets')
  }

  // Atwater factors (4 kcal/g protein & carbs, 9 kcal/g fat) — a live
  // suggestion, not a lock: it keeps recomputing until the calorie field
  // itself is edited, at which point it becomes a deliberate override.
  const updateTargetField = (field, rawValue) => {
    const next = { ...targetForm, [field]: rawValue }
    if (!calorieTargetTouched) {
      const p = Number(next.proteinG) || 0
      const f = Number(next.fatG) || 0
      const c = Number(next.carbsG) || 0
      next.calorieTarget = p || f || c ? String(Math.round(p * 4 + f * 9 + c * 4)) : ''
    }
    setTargetForm(next)
  }

  const handleSaveTargets = async (e) => {
    e.preventDefault()
    setSavingTarget(true)
    setTargetError(null)
    try {
      await api('/api/macro-goal', {
        method: 'PUT',
        body: JSON.stringify({
          proteinG: Number(targetForm.proteinG),
          fatG: Number(targetForm.fatG),
          carbsG: Number(targetForm.carbsG),
          ...(targetForm.calorieTarget ? { calorieTarget: Number(targetForm.calorieTarget) } : {}),
        }),
      })
      setMode('view')
      load()
    } catch {
      setTargetError('Could not save your targets — please check the values and try again')
    } finally {
      setSavingTarget(false)
    }
  }

  const startLogFood = () => {
    setMealForm(emptyMealForm)
    setMealError(null)
    setMode('logFood')
  }

  const handleSaveMeal = async (e) => {
    e.preventDefault()
    setSavingMeal(true)
    setMealError(null)
    try {
      await api('/api/meals', {
        method: 'POST',
        body: JSON.stringify({
          description: mealForm.description,
          calories: Number(mealForm.calories),
          ...(mealForm.proteinG ? { proteinG: Number(mealForm.proteinG) } : {}),
          ...(mealForm.fatG ? { fatG: Number(mealForm.fatG) } : {}),
          ...(mealForm.carbsG ? { carbsG: Number(mealForm.carbsG) } : {}),
        }),
      })
      setMode('view')
      load()
    } catch {
      setMealError('Could not log that meal — please check the values and try again')
    } finally {
      setSavingMeal(false)
    }
  }

  const handleRemoveMeal = async (id) => {
    await api(`/api/meals/${id}`, { method: 'DELETE' })
    load()
  }

  const isLoading = goal === undefined || meals === undefined
  const todayTotals = meals ? sumToday(meals) : null

  const bmr = tdeeProfile
    ? computeBmr(bodyweight, tdeeProfile.heightCm, tdeeProfile.age, tdeeProfile.sex)
    : null
  const tdee = tdeeProfile ? computeTdee(bmr, tdeeProfile.activityLevel) : null

  const applyTdeeGoal = (delta) => {
    setCalorieTargetTouched(true)
    setTargetForm((f) => ({ ...f, calorieTarget: String(tdee + delta) }))
  }

  return (
    <div className="w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-third">Today's macros</h2>
        {mode === 'view' && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={startLogFood}
              className="text-xs font-medium text-third/60 transition hover:text-third"
            >
              Log food
            </button>
            {goal && (
              <button
                type="button"
                onClick={startEditTargets}
                className="text-xs font-medium text-third/60 transition hover:text-third"
              >
                Edit targets
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading && <p className="text-xs text-third/60">Loading…</p>}

      {!isLoading && mode === 'view' && !goal && (
        <div className="text-center">
          <p className="mb-3 text-xs text-third/60">
            Set your daily protein, fat, and carb targets to start tracking.
          </p>
          <button
            type="button"
            onClick={startEditTargets}
            className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
          >
            Set your daily targets
          </button>
        </div>
      )}

      {!isLoading && mode === 'view' && goal && (
        <div>
          <div className="mb-3 flex justify-end gap-1">
            {UNITS.map((u) => (
              <button
                key={u.key}
                type="button"
                onClick={() => setUnit(u.key)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  unit === u.key ? 'bg-third text-main' : 'text-third/60 hover:text-third'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <LifeBar
              label="Protein"
              value={todayTotals.proteinG}
              target={goal.proteinG}
              unit={unit}
              multiplier={4}
            />
            <LifeBar label="Fat" value={todayTotals.fatG} target={goal.fatG} unit={unit} multiplier={9} />
            <LifeBar
              label="Carbs"
              value={todayTotals.carbsG}
              target={goal.carbsG}
              unit={unit}
              multiplier={4}
            />

            {goal.calorieTarget && (
              <div className="mt-2 border-t border-secondary/25 pt-4">
                <LifeBar
                  label="Total calories"
                  value={todayTotals.calories}
                  target={goal.calorieTarget}
                  unit={unit === 'percent' ? 'percent' : 'cal'}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {!isLoading && mode === 'view' && meals.length > 0 && (
        <ul className={`flex flex-col gap-2 ${goal ? 'mt-5' : ''}`}>
          {meals.map((meal) => {
            const macros = [
              formatMacro(meal.proteinG, 'g P'),
              formatMacro(meal.fatG, 'g F'),
              formatMacro(meal.carbsG, 'g C'),
            ].filter(Boolean)

            return (
              <li
                key={meal.id}
                className="flex items-center justify-between rounded-lg border border-secondary/25 px-3 py-2 text-sm"
              >
                <div>
                  <p className="text-third">{meal.description}</p>
                  <p className="text-xs text-third/60">
                    {meal.calories} cal{macros.length > 0 ? ` · ${macros.join(' · ')}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMeal(meal.id)}
                  className="text-xs font-medium text-third/60 transition hover:text-red-400"
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {mode === 'editTargets' && (
        <form onSubmit={handleSaveTargets} className="flex flex-col gap-3">
          {['proteinG', 'fatG', 'carbsG'].map((field) => (
            <label key={field} className="flex items-center justify-between gap-3 text-sm">
              <span className="capitalize text-third">
                {field === 'proteinG' ? 'Protein (g)' : field === 'fatG' ? 'Fat (g)' : 'Carbs (g)'}
              </span>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={targetForm[field]}
                onChange={(e) => updateTargetField(field, e.target.value)}
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
                value={targetForm.calorieTarget}
                onChange={(e) => {
                  setCalorieTargetTouched(true)
                  setTargetForm({ ...targetForm, calorieTarget: e.target.value })
                }}
                className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
              />
            </label>
            {!calorieTargetTouched && targetForm.calorieTarget && (
              <p className="mt-1 text-right text-xs text-third/60">
                Auto-calculated from protein/fat/carbs — edit to override
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
              disabled={savingTarget}
              className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
            >
              {savingTarget ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {targetError && <p className="text-center text-xs text-red-400">{targetError}</p>}
        </form>
      )}

      {mode === 'logFood' && (
        <form onSubmit={handleSaveMeal} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-third">Description</span>
            <input
              type="text"
              required
              value={mealForm.description}
              onChange={(e) => setMealForm({ ...mealForm, description: e.target.value })}
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
              value={mealForm.calories}
              onChange={(e) => setMealForm({ ...mealForm, calories: e.target.value })}
              className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            {['proteinG', 'fatG', 'carbsG'].map((field) => (
              <label key={field} className="flex flex-col gap-1 text-xs">
                <span className="text-third/60">
                  {field === 'proteinG' ? 'Protein (g)' : field === 'fatG' ? 'Fat (g)' : 'Carbs (g)'}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={mealForm[field]}
                  onChange={(e) => setMealForm({ ...mealForm, [field]: e.target.value })}
                  placeholder="0"
                  className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
                />
              </label>
            ))}
          </div>

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={savingMeal}
              className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
            >
              {savingMeal ? 'Saving…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {mealError && <p className="text-center text-xs text-red-400">{mealError}</p>}
        </form>
      )}
    </div>
  )
}

export default MacroStatsCard
