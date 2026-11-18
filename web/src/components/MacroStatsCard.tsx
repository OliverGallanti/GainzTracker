import { useState } from 'react'
import type { MacroGoal, Meal } from '@gainz/shared/types'
import { api } from '../lib/api'
import { addDays, dayLabel, dayRange, startOfLocalDay } from '@gainz/shared/dates'
import { computeBmr, computeTdee } from '@gainz/shared/tdee'
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Target, Utensils } from 'lucide-react'
import { OTHER_MEAL, groupByMeal, sumToday } from '@gainz/shared/macros'
import { useMe, useWeights } from '../lib/sharedData'
import { useLoad } from '../lib/useLoad'
import { useSubmit } from '../lib/useSubmit'
import LifeBar from './LifeBar'
import MacroTargetsForm from './MacroTargetsForm'
import LogFoodDialog from './LogFoodDialog'
import MealList from './MealList'
import MealSlotsForm from './MealSlotsForm'
import MonthGrid from './MonthGrid'

const UNITS = [
  { key: 'g', label: 'g' },
  { key: 'cal', label: 'Cal' },
  { key: 'percent', label: '%' },
]

function MacroStatsCard() {
  const [mode, setMode] = useState('view') // 'view' | 'editTargets' | 'editMeals'
  // The Log food dialog: logging into a meal, or editing a logged food.
  const [food, setFood] = useState<{ logMeal: string } | { edit: Meal } | null>(null)
  const [unit, setUnit] = useState('g') // 'g' | 'cal' | 'percent' — display only, never affects fill

  // The day shown: null = today, so the card moves on to the new day at midnight.
  const [picked, setPicked] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const day = picked ?? startOfLocalDay()
  const isToday = picked == null
  const go = (date: Date | null) => setPicked(date && startOfLocalDay(date) < startOfLocalDay() ? startOfLocalDay(date) : null)

  // The card's own data: the macro target and that day's meals.
  const own = useLoad(['today', day.toDateString()], async () => {
    const { since, until } = dayRange(day)
    const [goal, meals] = await Promise.all([
      api<MacroGoal | null>('/api/macro-goal'),
      api<Meal[]>(`/api/meals?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`),
    ])
    return { goal, meals }
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

  const openLogFood = (mealName: string) => setFood({ logMeal: mealName })

  // "Other" isn't a real slot: moving there clears the food's slot.
  const { submit: moveMeal, error: moveError } = useSubmit(async (id, mealName) => {
    await api(`/api/meals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ mealName: mealName === OTHER_MEAL ? null : mealName }),
    })
    own.reload()
  }, 'Could not move that food: please try again')

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
        <h2 className="card-title">{isToday ? "Today's macros" : `Macros · ${dayLabel(day)}`}</h2>
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
            {/* Targets aren't kept per day: a past day is shown against today's. */}
            {goal && isToday && (
              <button type="button" onClick={() => setMode('editTargets')} className="btn btn-primary">
                <Target size={14} />
                Edit targets
              </button>
            )}
          </div>
        )}
      </div>

      {mode === 'view' && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => go(addDays(day, -1))} aria-label="Previous day" className="rounded-lg p-2 text-third/60 transition hover:text-third">
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen((open) => !open)}
              aria-expanded={calendarOpen}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-third transition hover:bg-third/10"
            >
              <CalendarDays size={16} className="text-third/60" />
              {dayLabel(day)}
            </button>
            <button
              type="button"
              onClick={() => go(addDays(day, 1))}
              disabled={isToday}
              aria-label="Next day"
              className="rounded-lg p-2 text-third/60 transition hover:text-third disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {calendarOpen && (
            <FoodCalendar
              selected={day}
              onSelect={(date) => {
                go(date)
                setCalendarOpen(false)
              }}
            />
          )}
        </div>
      )}

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
          <MealList groups={groups} onAdd={openLogFood} onMove={moveMeal} onEdit={(meal) => setFood({ edit: meal })} />
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

      {food && (
        <LogFoodDialog
          mealNames={mealNames}
          defaultMeal={'logMeal' in food ? food.logMeal : OTHER_MEAL}
          editing={'edit' in food ? food.edit : undefined}
          day={day}
          onChanged={own.reload}
          onClose={() => setFood(null)}
        />
      )}

      {mode === 'editMeals' && (
        <MealSlotsForm mealNames={mealNames} onSaved={handleMealsSaved} onCancel={() => setMode('view')} />
      )}
    </div>
  )
}

// The month with the days that have food filled in. Only mounted while open,
// so each open refetches the month.
function FoodCalendar({ selected, onSelect }: { selected: Date; onSelect: (date: Date | null) => void }) {
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))
  const days = useLoad(['mealDays', month.toDateString()], async () => {
    const since = month.toISOString()
    const until = new Date(new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime() - 1).toISOString()
    const meals = await api<Meal[]>(`/api/meals?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`)
    return [...new Set(meals.map((m) => new Date(m.loggedAt).toDateString()))]
  })
  const logged = new Set(days.data)

  return (
    <div className="mt-3 rounded-lg border border-secondary/25 p-3">
      <MonthGrid
        mark={(date) => (logged.has(date.toDateString()) ? { filled: true, note: 'food logged' } : undefined)}
        selected={selected}
        onSelect={onSelect}
        onMonth={setMonth}
      />
      {days.error ? (
        <p className="mt-2 text-xs text-red-400">
          Could not load the logged days:{' '}
          <button type="button" onClick={days.reload} className="underline hover:no-underline">
            retry
          </button>
        </p>
      ) : (
        <p className="mt-2 text-[10px] text-third/60">Filled days have food logged.</p>
      )}
    </div>
  )
}

export default MacroStatsCard
