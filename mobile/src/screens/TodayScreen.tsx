import { StyleSheet, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfLocalDay } from '@gainz/shared/dates'
import { formatMacro, groupByMeal, OTHER_MEAL, sumToday } from '@gainz/shared/macros'
import type { MacroGoal, Meal } from '@gainz/shared/types'
import { api } from '../api'
import { Target, Utensils } from '../icons'
import { todayKey } from '../offline'
import { useMe, useWeights } from '../queries'
import { newDayToday, QUEUED, useQueued, useUnsyncedIds, type MoveMealVars, type RemoveVars } from '../queue'
import { colors } from '../theme'
import { Text, Button, Card, Chip, ErrorText, Muted, Screen, Sheet, Unsynced, styles as ui, useAnimatedState } from '../ui'
import LogFoodForm from './LogFoodForm'
import TargetsForm from './TargetsForm'

// Today's macros: the same data and grouping as the web card, phone-sized.
export default function TodayScreen() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useAnimatedState<'view' | 'targets' | { logMeal: string }>('view')
  const me = useMe()
  const weights = useWeights()

  const today = useQuery({
    queryKey: todayKey(),
    queryFn: async () => {
      const since = startOfLocalDay().toISOString()
      const [goal, meals] = await Promise.all([
        api<MacroGoal | null>('/api/macro-goal'),
        api<Meal[]>(`/api/meals?since=${encodeURIComponent(since)}`),
      ])
      return { goal, meals }
    },
    initialData: () => newDayToday(queryClient),
    initialDataUpdatedAt: 1, // always out of date, so the real day is still fetched
  })

  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const move = useQueued<MoveMealVars>(QUEUED.moveMeal)
  const unsynced = useUnsyncedIds()
  const [movingId, setMovingId] = useAnimatedState<string | null>(null)

  const goal = today.data?.goal ?? null
  const meals = today.data?.meals ?? []
  const mealNames = me.data?.mealNames ?? []
  const totals = sumToday(meals)
  const groups = today.data && me.data ? groupByMeal(meals, mealNames) : []
  const nextMeal = groups.find((g) => g.entries.length === 0 && g.name !== OTHER_MEAL)?.name ?? mealNames[0] ?? OTHER_MEAL
  const ready = today.data && me.data

  return (
    <Screen>
      <Card
        title="Today's macros"
        right={ready && mode === 'view' && goal ? <Button label="Targets" icon={Target} variant="small" onPress={() => setMode('targets')} /> : null}
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

        {ready && mode !== 'targets' && <Button label="Log food" icon={Utensils} onPress={() => setMode({ logMeal: nextMeal })} />}
      </Card>

      <Sheet visible={typeof mode === 'object'} title="Log food" onClose={() => setMode('view')}>
        {typeof mode === 'object' && <LogFoodForm mealNames={mealNames} defaultMeal={mode.logMeal} onDone={() => setMode('view')} />}
      </Sheet>

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
            <View key={meal.id} style={{ gap: 8 }}>
              <View style={styles.mealRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.text}>{meal.description}</Text>
                  <Muted>
                    {[`${meal.calories} cal`, formatMacro(meal.proteinG, 'g P'), formatMacro(meal.fatG, 'g F'), formatMacro(meal.carbsG, 'g C')]
                      .filter(Boolean)
                      .join(' · ')}
                  </Muted>
                  {unsynced.has(meal.id) && <Unsynced />}
                </View>
                <Button
                  label="Move"
                  variant="small"
                  onPress={() => setMovingId(movingId === meal.id ? null : meal.id)}
                  accessibilityLabel={`Move ${meal.description} to another meal`}
                />
                <Button
                  label="Remove"
                  variant="small"
                  onPress={() => remove.mutate({ label: `Remove ${meal.description}`, path: `/api/meals/${meal.id}`, cacheKey: ['today'], id: meal.id })}
                  accessibilityLabel={`Remove ${meal.description}`}
                />
              </View>
              {movingId === meal.id && (
                <View style={ui.chips}>
                  {[...mealNames, OTHER_MEAL].map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      selected={group.name === name}
                      onPress={() => {
                        setMovingId(null)
                        if (group.name === name) return
                        move.mutate({ label: `Move ${meal.description}`, id: meal.id, mealName: name === OTHER_MEAL ? null : name })
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
        </Card>
      ))}
    </Screen>
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
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(220, 224, 217, 0.15)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.text },
  barOver: { backgroundColor: '#fbbf24' },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faint: { color: 'rgba(220, 224, 217, 0.45)' },
})
