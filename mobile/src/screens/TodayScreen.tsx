import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, dayLabel, dayRange, startOfLocalDay } from '@gainz/shared/dates'
import { formatAmount, formatMacro, groupByMeal, OTHER_MEAL, sumToday } from '@gainz/shared/macros'
import type { MacroGoal, Meal } from '@gainz/shared/types'
import { api } from '../api'
import { CalendarDays, ChevronLeft, ChevronRight, Target, Utensils } from '../icons'
import { useMe, useWeights } from '../queries'
import { newDayToday, useUnsyncedIds } from '../queue'
import { colors } from '../theme'
import { Text, Button, Card, ErrorText, IconButton, Muted, Screen, Sheet, Unsynced, styles as ui, useAnimatedState } from '../ui'
import LogFood from './LogFoodForm'
import TargetsForm from './TargetsForm'
import Calendar from './training/Calendar'

// A day's macros (today unless an earlier day is picked): the same data and
// grouping as the web card, phone-sized.
export default function TodayScreen() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useAnimatedState<'view' | 'targets'>('view')
  // The Log food sheet: logging into a meal, or editing a logged food.
  const [food, setFood] = useState<{ logMeal: string } | { edit: Meal } | null>(null)
  const me = useMe()
  const weights = useWeights()
  // null = today, so the screen moves on to the new day at midnight.
  const [picked, setPicked] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const day = picked ?? startOfLocalDay()
  const isToday = picked == null
  const go = (date: Date | null) => setPicked(date && startOfLocalDay(date) < startOfLocalDay() ? startOfLocalDay(date) : null)

  // The date is part of the key: offline the next morning, the saved cache must
  // not present yesterday's meals as today's. Each day is cached on its own.
  const today = useQuery({
    queryKey: ['today', day.toDateString()],
    queryFn: async () => {
      const { since, until } = dayRange(day)
      const [goal, meals] = await Promise.all([
        api<MacroGoal | null>('/api/macro-goal'),
        api<Meal[]>(`/api/meals?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`),
      ])
      return { goal, meals }
    },
    initialData: () => (isToday ? newDayToday(queryClient) : undefined),
    initialDataUpdatedAt: 1, // always out of date, so the real day is still fetched
  })

  const unsynced = useUnsyncedIds()

  const goal = today.data?.goal ?? null
  const meals = today.data?.meals ?? []
  const mealNames = me.data?.mealNames ?? []
  const totals = sumToday(meals)
  const groups = today.data && me.data ? groupByMeal(meals, mealNames) : []
  const nextMeal = groups.find((g) => g.entries.length === 0 && g.name !== OTHER_MEAL)?.name ?? mealNames[0] ?? OTHER_MEAL
  const ready = today.data && me.data

  return (
    <Screen>
      <View style={styles.dayNav}>
        <IconButton icon={ChevronLeft} label="Previous day" onPress={() => go(addDays(day, -1))} />
        <Pressable
          onPress={() => setCalendarOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${dayLabel(day)}. Pick a day`}
          style={({ pressed }) => [styles.dayPick, pressed && ui.dim]}
        >
          <CalendarDays size={16} color={colors.muted} />
          <Text style={ui.text}>{dayLabel(day)}</Text>
        </Pressable>
        <IconButton icon={ChevronRight} label="Next day" disabled={isToday} onPress={() => go(addDays(day, 1))} />
      </View>

      <Sheet visible={calendarOpen} title="Pick a day" onClose={() => setCalendarOpen(false)}>
        <FoodCalendar
          selected={day}
          onSelect={(date) => {
            go(date)
            setCalendarOpen(false)
          }}
        />
      </Sheet>

      <Card
        title={isToday ? "Today's macros" : `Macros · ${dayLabel(day)}`}
        // Targets aren't kept per day: a past day is shown against today's.
        right={ready && mode === 'view' && goal && isToday ? <Button label="Targets" icon={Target} variant="small" onPress={() => setMode('targets')} /> : null}
      >
        {(today.isPending || me.isPending) && <Muted>Loading…</Muted>}
        {(today.isLoadingError || me.isLoadingError) && (
          <ErrorText onPress={() => void Promise.all([today.refetch(), me.refetch()])}>
            Could not load your macros: tap to retry
          </ErrorText>
        )}

        {ready && mode === 'targets' && (
          <TargetsForm goal={goal} me={me.data} bodyweight={weights.data?.[0]?.weightKg ?? null} onDone={() => setMode('view')} />
        )}

        {ready && mode === 'view' && !goal && (
          <>
            <Muted>Set your daily protein, fat and carb targets to start tracking.</Muted>
            <Button label="Set your daily targets" icon={Target} onPress={() => setMode('targets')} />
          </>
        )}

        {ready && mode === 'view' && goal && (
          <View style={{ gap: 12 }}>
            <Bar label="Protein" value={totals.proteinG} target={goal.proteinG} unit="g" />
            <Bar label="Fat" value={totals.fatG} target={goal.fatG} unit="g" />
            <Bar label="Carbs" value={totals.carbsG} target={goal.carbsG} unit="g" />
            {goal.calorieTarget != null && <Bar label="Calories" value={totals.calories} target={goal.calorieTarget} unit=" cal" />}
          </View>
        )}

        {ready && mode === 'view' && <Button label="Log food" icon={Utensils} onPress={() => setFood({ logMeal: nextMeal })} />}
      </Card>

      {food && (
        <LogFood
          mealNames={mealNames}
          defaultMeal={'logMeal' in food ? food.logMeal : OTHER_MEAL}
          editing={'edit' in food ? food.edit : undefined}
          day={day}
          onClose={() => setFood(null)}
        />
      )}

      {groups.map((group) => (
        <Card
          key={group.name}
          title={group.name}
          right={
            group.entries.length > 0 ? (
              <Muted>
                {Math.round(group.totals.calories)} cal · {Math.round(group.totals.proteinG)}g P
              </Muted>
            ) : null
          }
        >
          {group.entries.length === 0 && <Text style={styles.faint}>Nothing logged</Text>}
          {group.entries.map((meal) => (
            <Pressable
              key={meal.id}
              onPress={() => setFood({ edit: meal })}
              accessibilityRole="button"
              accessibilityLabel={`${meal.description}, ${meal.calories} calories. Edit`}
              style={({ pressed }) => [styles.mealRow, pressed && ui.dim]}
            >
              <View style={{ flex: 1 }}>
                <Text style={ui.text}>{meal.description}</Text>
                <Muted>
                  {[
                    meal.amount != null && meal.unit ? formatAmount(meal.amount, meal.unit) : null,
                    `${meal.calories} cal`,
                    formatMacro(meal.proteinG, 'g P'),
                    formatMacro(meal.fatG, 'g F'),
                    formatMacro(meal.carbsG, 'g C'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Muted>
                {unsynced.has(meal.id) && <Unsynced />}
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Card>
      ))}
    </Screen>
  )
}

// The month with the days that have food filled in. It's only mounted while the
// sheet is open, so each open refetches the month.
function FoodCalendar({ selected, onSelect }: { selected: Date; onSelect: (date: Date | null) => void }) {
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))
  const days = useQuery({
    queryKey: ['mealDays', month.toDateString()],
    queryFn: async () => {
      const since = month.toISOString()
      const until = new Date(new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime() - 1).toISOString()
      const meals = await api<Meal[]>(`/api/meals?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`)
      return [...new Set(meals.map((m) => new Date(m.loggedAt).toDateString()))]
    },
  })
  const logged = new Set(days.data)

  return (
    <View style={{ gap: 12 }}>
      <Calendar
        mark={(date) => (logged.has(date.toDateString()) ? { filled: true, note: 'food logged' } : undefined)}
        selected={selected}
        onSelect={onSelect}
        onMonth={setMonth}
      />
      {days.isLoadingError ? (
        <ErrorText onPress={() => void days.refetch()}>Could not load the logged days: tap to retry</ErrorText>
      ) : (
        <Muted>Filled days have food logged. Pick one to see or change it.</Muted>
      )}
    </View>
  )
}

function Bar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const percent = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <View accessible accessibilityLabel={`${label}: ${Math.round(value)} of ${Math.round(target)}${unit}`}>
      <View style={styles.barLabels}>
        <Text style={ui.text}>{label}</Text>
        <Muted>
          {Math.round(value)}
          {unit} / {Math.round(target)}
          {unit}
        </Muted>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%` }, value > target && styles.barOver]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayPick: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(220, 224, 217, 0.15)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.text },
  barOver: { backgroundColor: '#fbbf24' },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  faint: { color: 'rgba(220, 224, 217, 0.45)' },
})
