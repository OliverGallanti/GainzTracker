import { useState } from 'react'
import { api } from '../lib/api'
import { startOfLocalDay } from '../lib/dates'
import { computeBmr, computeTdee } from '../lib/tdee'
import { OTHER_MEAL, groupByMeal, sumToday } from '../lib/macros'
import { useMe, useWeights } from '../lib/sharedData'
import { useLoad } from '../lib/useLoad'
import LifeBar from './LifeBar'
import MacroTargetsForm from './MacroTargetsForm'
import MealForm from './MealForm'
import MealList from './MealList'
import MealSlotsForm from './MealSlotsForm'

const UNITS = [
  { key: 'g', label: 'g' },
  { key: 'cal', label: 'Cal' },
  { key: 'percent', label: '%' },
]

function MacroStatsCard() {
  const [mode, setMode] = useState('view') // 'view' | 'editTargets' | 'logFood' | 'editMeals'
  const [logMeal, setLogMeal] = useState(undefined) // the meal slot the food form opens on
  const [unit, setUnit] = useState('g') // 'g' | 'cal' | 'percent' — display only, never affects fill

  // The card's own data: the macro target, today's meals, and saved foods.
  const own = useLoad(async () => {
    const since = startOfLocalDay().toISOString()
    const [goal, meals, savedFoods] = await Promise.all([
      api('/api/macro-goal'),
      api(`/api/meals?since=${encodeURIComponent(since)}`),
      api('/api/saved-foods'),
    ])
    return { goal, meals, savedFoods }
  })

  // Only read for the TDEE calculator inside the targets form.
  const me = useMe()
  const weights = useWeights()

  const goal = own.data?.goal // null = no target set yet
  const meals = own.data?.meals
  const mealNames = me.data?.mealNames ?? []

  // All four were fetched together before, so loading/error stay all-or-nothing.
  const isLoading = own.data === undefined || me.data === undefined || weights.data === undefined
  const loadError = own.error || me.error || weights.error
  const retry = () => {
    own.reload()
    me.reload()
    weights.reload()
  }

  const handleSaved = () => {
    setMode('view')
    own.reload()
  }

  const handleMealsSaved = () => {
    setMode('view')
    me.reload()
    own.reload() // foods under a renamed or removed meal regroup
  }

  const openLogFood = (mealName) => {
    setLogMeal(mealName)
    setMode('logFood')
  }

  const handleRemoveMeal = async (id) => {
    await api(`/api/meals/${id}`, { method: 'DELETE' })
    own.reload()
  }

  const todayTotals = meals ? sumToday(meals) : null
  const groups = meals ? groupByMeal(meals, mealNames) : []
  // "Log food" opens on the first meal with nothing in it yet — usually the next one to eat.
  const nextMeal =
    groups.find((g) => g.entries.length === 0 && g.name !== OTHER_MEAL)?.name ?? mealNames[0]

  // Already sorted loggedAt desc by the API, so [0] is the latest weigh-in.
  const bodyweight = weights.data?.length ? weights.data[0].weightKg : null
  const bmr = me.data
    ? computeBmr(bodyweight, me.data.heightCm, me.data.age, me.data.sex)
    : null
  const tdee = me.data ? computeTdee(bmr, me.data.activityLevel) : null

  return (
    <div className="glow-card w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-third">Today's macros</h2>
        {mode === 'view' && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => openLogFood(nextMeal)}
              className="text-xs font-medium text-third/60 transition hover:text-third"
            >
              Log food
            </button>
            <button
              type="button"
              onClick={() => setMode('editMeals')}
              className="text-xs font-medium text-third/60 transition hover:text-third"
            >
              Meals
            </button>
            {goal && (
              <button
                type="button"
                onClick={() => setMode('editTargets')}
                className="text-xs font-medium text-third/60 transition hover:text-third"
              >
                Edit targets
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading && !loadError && <p className="text-xs text-third/60">Loading…</p>}

      {loadError && (
        <p className="text-xs text-red-400">
          Could not load your macros —{' '}
          <button type="button" onClick={retry} className="underline hover:no-underline">
            retry
          </button>
        </p>
      )}

      {!isLoading && mode === 'view' && !goal && (
        <div className="text-center">
          <p className="mb-3 text-xs text-third/60">
            Set your daily protein, fat, and carb targets to start tracking.
          </p>
          <button
            type="button"
            onClick={() => setMode('editTargets')}
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

      {!isLoading && mode === 'view' && (
        <div className={goal ? 'mt-5' : ''}>
          <MealList groups={groups} onAdd={openLogFood} onRemove={handleRemoveMeal} />
        </div>
      )}

      {mode === 'editTargets' && (
        <MacroTargetsForm
          goal={goal}
          tdee={tdee}
          onSaved={handleSaved}
          onCancel={() => setMode('view')}
        />
      )}

      {mode === 'logFood' && (
        <MealForm
          mealNames={mealNames}
          defaultMeal={logMeal}
          savedFoods={own.data.savedFoods}
          onSaved={handleSaved}
          onSavedFoodsChanged={own.reload}
          onCancel={() => setMode('view')}
        />
      )}

      {mode === 'editMeals' && (
        <MealSlotsForm mealNames={mealNames} onSaved={handleMealsSaved} onCancel={() => setMode('view')} />
      )}
    </div>
  )
}

export default MacroStatsCard
