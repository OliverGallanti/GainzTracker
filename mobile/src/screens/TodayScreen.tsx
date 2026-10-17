import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfLocalDay } from '@gainz/shared/dates'
import { formatMacro, groupByMeal, OTHER_MEAL, sumToday } from '@gainz/shared/macros'
import type { MacroGoal, Me, Meal } from '@gainz/shared/types'
import { api } from '../api'
import { useAuth } from '../auth'
import { colors } from '../theme'
import LogFoodForm from './LogFoodForm'

// Today's macros: the same data and grouping as the web card, phone-sized.
export default function TodayScreen() {
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const [logMeal, setLogMeal] = useState<string | null>(null) // the meal the form opens on; null = closed

  const today = useQuery({
    queryKey: ['today'],
    queryFn: async () => {
      const since = startOfLocalDay().toISOString()
      const [me, goal, meals] = await Promise.all([
        api<Me>('/api/me'),
        api<MacroGoal | null>('/api/macro-goal'),
        api<Meal[]>(`/api/meals?since=${encodeURIComponent(since)}`),
      ])
      return { me, goal, meals }
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/meals/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['today'] }),
  })

  const data = today.data
  const totals = sumToday(data?.meals ?? [])
  const groups = data ? groupByMeal(data.meals, data.me.mealNames) : []
  const nextMeal = groups.find((g) => g.entries.length === 0 && g.name !== OTHER_MEAL)?.name ?? data?.me.mealNames[0] ?? OTHER_MEAL

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={today.isRefetching} onRefresh={() => void today.refetch()} tintColor={colors.text} />}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>
          Gainz<Text style={styles.muted}>.Tracker</Text>
        </Text>
        <Pressable onPress={signOut} accessibilityRole="button" style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          Today's macros
        </Text>

        {today.isPending && <Text style={styles.muted}>Loading…</Text>}
        {today.isError && (
          <Text style={styles.error} onPress={() => today.refetch()}>
            Could not load your macros: tap to retry
          </Text>
        )}

        {data && !data.goal && (
          <Text style={styles.muted}>Set your daily targets in the web app to see your progress here.</Text>
        )}

        {data?.goal && (
          <View style={styles.bars}>
            <Bar label="Protein" value={totals.proteinG} target={data.goal.proteinG} unit="g" />
            <Bar label="Fat" value={totals.fatG} target={data.goal.fatG} unit="g" />
            <Bar label="Carbs" value={totals.carbsG} target={data.goal.carbsG} unit="g" />
            {data.goal.calorieTarget != null && (
              <Bar label="Calories" value={totals.calories} target={data.goal.calorieTarget} unit=" cal" />
            )}
          </View>
        )}

        {data && logMeal == null && (
          <Pressable onPress={() => setLogMeal(nextMeal)} accessibilityRole="button" style={styles.primary}>
            <Text style={styles.primaryText}>Log food</Text>
          </Pressable>
        )}

        {data && logMeal != null && (
          <LogFoodForm mealNames={data.me.mealNames} defaultMeal={logMeal} onDone={() => setLogMeal(null)} />
        )}
      </View>

      {groups.map((group) => (
        <View key={group.name} style={styles.card}>
          <View style={styles.mealHeader}>
            <Text style={styles.mealTitle} accessibilityRole="header">
              {group.name}
            </Text>
            {group.entries.length > 0 && (
              <Text style={styles.muted}>
                {Math.round(group.totals.calories)} cal · {Math.round(group.totals.proteinG)}g P
              </Text>
            )}
          </View>

          {group.entries.length === 0 && <Text style={styles.faint}>Nothing logged</Text>}
          {group.entries.map((meal) => (
            <View key={meal.id} style={styles.mealRow}>
              <View style={styles.flex}>
                <Text style={styles.text}>{meal.description}</Text>
                <Text style={styles.muted}>
                  {[`${meal.calories} cal`, formatMacro(meal.proteinG, 'g P'), formatMacro(meal.fatG, 'g F'), formatMacro(meal.carbsG, 'g C')]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Pressable
                onPress={() => remove.mutate(meal.id)}
                disabled={remove.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${meal.description}`}
                hitSlop={8}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}
      {remove.isError && <Text style={styles.error}>Could not remove that food: please try again</Text>}
    </ScrollView>
  )
}

function Bar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const percent = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <View accessible accessibilityLabel={`${label}: ${Math.round(value)} of ${Math.round(target)}${unit}`}>
      <View style={styles.barLabels}>
        <Text style={styles.text}>{label}</Text>
        <Text style={styles.muted}>
          {Math.round(value)}
          {unit} / {Math.round(target)}
          {unit}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%` }, value > target && styles.barOver]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.main },
  content: { padding: 16, paddingTop: 48, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 20, fontWeight: '700', color: colors.text },
  card: { gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  bars: { gap: 12 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(220, 224, 217, 0.15)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.text },
  barOver: { backgroundColor: '#fbbf24' },
  mealHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  mealTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  text: { color: colors.text },
  muted: { color: colors.muted },
  faint: { color: 'rgba(220, 224, 217, 0.45)' },
  error: { color: colors.danger },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.text },
  primaryText: { fontSize: 16, fontWeight: '600', color: colors.main },
  smallButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  smallButtonText: { color: colors.text, fontWeight: '500' },
})
