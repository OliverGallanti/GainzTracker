import { useState } from 'react'
import type { MacroGoal, Meal, SavedFood } from '@gainz/shared/types'
import { api } from '../lib/api'
import { startOfLocalDay } from '@gainz/shared/dates'
import { computeBmr, computeTdee } from '@gainz/shared/tdee'
import { LayoutList, Target, Utensils } from 'lucide-react'
import { OTHER_MEAL, groupByMeal, sumToday } from '@gainz/shared/macros'
import { useMe, useWeights } from '../lib/sharedData'
import { useLoad } from '../lib/useLoad'
import { useSubmit } from '../lib/useSubmit'
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
  const [logMeal, setLogMeal] = useState<string | undefined>(undefined) // the meal slot the food form opens on
  const [unit, setUnit] = useState('g') // 'g' | 'cal' | 'percent' — display only, never affects fill

  // The card's own data: the macro target, today's meals, and saved foods.
  const own = useLoad(async () => {
    const since = startOfLocalDay().toISOString()
    const [goal, meals, savedFoods] = await Promise.all([
      api<MacroGoal | null>('/api/macro-goal'),
      api<Meal[]>(`/api/meals?since=${encodeURIComponent(since)}`),
      api<SavedFood[]>('/api/saved-foods'),
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

  const openLogFood = (mealName: string) => {
    setLogMeal(mealName)
    setMode('logFood')
  }

  // "Other" isn't a real slot: moving there clears the food's slot.
  const { submit: moveMeal, error: moveError } = useSubmit(async (id, mealName) => {
    await api(`/api/meals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ mealName: mealName === OTHER_MEAL ? null : mealName }),
    })
    own.reload()
  }, 'Could not move that food: please try again')

  const handleRemoveMeal = async (id: string) => {
    await api(`/api/meals/${id}`, { method: 'DELETE' })
    own.reload()
  }

  const todayTotals = sumToday(meals ?? [])
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="card-title">Today's macros</h2>
        {mode === 'view' && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => openLogFood(nextMeal)} className="btn btn-secondary">
                <Utensils size={14} />
                Log food
              </button>
              <button type="button" onClick={() => setMode('editMeals')} className="btn btn-secondary">
                <LayoutList size={14} />
                Meals
              </button>
            </div>
            {goal && (
              <button type="button" onClick={() => setMode('editTargets')} className="btn btn-primary">
                <Target size={14} />
                Edit targets
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading && !loadError && <p className="text-xs text-third/60">Loading…</p>}

      {loadError && (
        <p className="text-xs text-red-400">
          Could not load your macros:{' '}
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
        <div className="mt-5">
          <MealList groups={groups} onAdd={openLogFood} onMove={moveMeal} onRemove={handleRemoveMeal} />
          {moveError && <p className="mt-2 text-xs text-red-400">{moveError}</p>}
        </div>
      )}

      {mode === 'editTargets' && (
        <MacroTargetsForm
          goal={goal}
          tdee={tdee}
          bodyweight={bodyweight}
          sex={me.data?.sex}
          age={me.data?.age}
          onSaved={handleSaved}
          onCancel={() => setMode('view')}
        />
      )}

      {mode === 'logFood' && (
        <MealForm
          mealNames={mealNames}
          defaultMeal={logMeal}
          savedFoods={own.data?.savedFoods ?? []}
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
