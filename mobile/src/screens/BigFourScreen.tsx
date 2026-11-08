import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { BIG_FOUR_LIFTS } from '@gainz/shared/lifts'
import { getStrengthReferenceLines, getStrengthTier } from '@gainz/shared/strength'
import type { WorkoutSet } from '@gainz/shared/types'
import { api } from '../api'
import LineChart from '../LineChart'
import { useMe, useWeights } from '../queries'
import { QUEUED, useQueued, useUnsyncedIds, type AddSetVars, type RemoveVars, type SetLiftGoalsVars } from '../queue'
import { colors } from '../theme'
import { Text, Button, Card, Chip, ErrorText, Field, Muted, Screen, Unsynced, styles as ui } from '../ui'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const describe = (set: WorkoutSet) => `${set.weightKg ?? '–'} kg${set.reps ? ` × ${set.reps}` : ''}`

// The web Big 4 card, phone-sized: ranked by each lift's most recent entry (not
// the all-time best), rated against bodyweight with the shared strength standards.
export default function BigFourScreen() {
  const me = useMe()
  const weights = useWeights()
  const sets = useQuery({ queryKey: ['workoutSets'], queryFn: () => api<WorkoutSet[]>('/api/workout-sets') }) // newest first
  const goals = useQuery({ queryKey: ['liftGoals'], queryFn: () => api<Record<string, number>>('/api/lift-goals') })
  const [selected, setSelected] = useState(BIG_FOUR_LIFTS[0])
  const [mode, setMode] = useState<'view' | 'log' | 'goals'>('view')

  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const unsynced = useUnsyncedIds()

  const loaded = sets.data && goals.data && me.data && weights.data
  const sex = me.data?.sex ?? null
  const bodyweight = weights.data?.[0]?.weightKg ?? null
  const bigFourSets = (sets.data ?? []).filter((s) => BIG_FOUR_LIFTS.includes(s.exerciseName))
  const ranked = BIG_FOUR_LIFTS.map((name) => {
    const latest = bigFourSets.find((s) => s.exerciseName === name) ?? null
    return { name, latest, tier: getStrengthTier(name, latest?.weightKg, bodyweight, sex) }
  }).sort((a, b) => (b.latest?.weightKg ?? -1) - (a.latest?.weightKg ?? -1))

  const current = ranked.find((r) => r.name === selected)!
  const goal = goals.data?.[selected]
  const levels = getStrengthReferenceLines(selected, bodyweight, sex)
  const history = bigFourSets
    .flatMap((s) => (s.exerciseName === selected && s.weightKg != null ? [{ loggedAt: s.performedAt, value: s.weightKg }] : []))
    .reverse() // oldest first
  const refresh = () => void Promise.all([sets.refetch(), goals.refetch(), me.refetch(), weights.refetch()])

  return (
    <Screen>
      <Card title="Big 4" right={loaded && mode === 'view' ? <Button label="Log lift" variant="small" onPress={() => setMode('log')} /> : null}>
        {!loaded && !(sets.isLoadingError || goals.isLoadingError) && <Muted>Loading…</Muted>}
        {(sets.isLoadingError || goals.isLoadingError) && <ErrorText onPress={refresh}>Could not load your lifts: tap to retry</ErrorText>}

        {loaded && mode === 'log' && <LogLiftForm initialLift={selected} onDone={() => setMode('view')} />}
        {loaded && mode === 'goals' && <GoalsForm goals={goals.data} onDone={() => setMode('view')} />}

        {loaded && mode === 'view' && (
          <>
            <View style={styles.tiles}>
              {ranked.map(({ name, latest, tier }, i) => (
                <Pressable
                  key={name}
                  onPress={() => setSelected(name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === name }}
                  accessibilityLabel={`${name}: ${latest ? `rank ${i + 1}, ${describe(latest)}${tier ? `, ${tier.label}` : ''}` : 'not logged yet'}`}
                  style={[styles.tile, selected === name && styles.tileSelected]}
                >
                  <View style={styles.tileTop}>
                    <Text style={latest ? styles.rank : ui.muted}>{latest ? `#${i + 1}` : '–'}</Text>
                    {tier && <Text>{tier.icon}</Text>}
                  </View>
                  <Text style={latest ? ui.text : ui.muted}>{name}</Text>
                  <Text style={latest ? styles.tileValue : ui.muted}>{latest ? describe(latest) : 'Not logged yet'}</Text>
                </Pressable>
              ))}
            </View>

            {sex == null && bigFourSets.length > 0 && <Muted>Set your sex in the Profile tab to see strength levels.</Muted>}

            <View style={styles.detail}>
              <View style={styles.detailHeader}>
                <Text style={ui.text}>
                  {selected} goal: <Text style={styles.strong}>{goal ? `${goal} kg` : 'not set'}</Text>
                </Text>
                <Button label={goal ? 'Edit goals' : 'Set goals'} variant="small" onPress={() => setMode('goals')} />
              </View>
              {current.tier && <Text style={ui.text}>{current.tier.icon} {current.tier.label}</Text>}
              {history.length > 0 ? (
                <LineChart data={history} unit="kg" goal={goal} referenceLines={levels} label={`${selected} progress`} />
              ) : (
                <Muted>No {selected} entries logged yet.</Muted>
              )}
              {levels.length > 0 && (
                <View style={{ gap: 2 }}>
                  <Muted>Strength levels at your bodyweight ({bodyweight} kg):</Muted>
                  {levels.map((level) => (
                    <Text
                      key={level.label}
                      style={(current.latest?.weightKg ?? 0) >= level.value ? ui.text : ui.muted}
                    >
                      {level.label}: {level.value} kg
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </Card>

      {loaded && bigFourSets.length > 0 && (
        <Card title="Recent lifts">
          {bigFourSets.slice(0, 20).map((set) => (
            <View key={set.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={ui.text}>
                  {set.exerciseName} · {describe(set)}
                </Text>
                <Muted>{formatDate(set.performedAt)}</Muted>
                {unsynced.has(set.id) && <Unsynced />}
              </View>
              <Button
                label="Remove"
                variant="small"
                onPress={() =>
                  remove.mutate({
                    label: `Remove ${set.exerciseName} ${describe(set)}`,
                    path: `/api/workout-sets/${set.id}`,
                    cacheKey: ['workoutSets'],
                    id: set.id,
                  })
                }
                accessibilityLabel={`Remove ${set.exerciseName} ${describe(set)} from ${formatDate(set.performedAt)}`}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  )
}

// Queued like the other writes (see queue.ts): shown straight away, sent when online.
function LogLiftForm({ initialLift, onDone }: { initialLift: string; onDone: () => void }) {
  const addSet = useQueued<AddSetVars>(QUEUED.addSet)
  const [lift, setLift] = useState(initialLift)
  const [weightKg, setWeightKg] = useState('')
  const [reps, setReps] = useState('')

  const save = () => {
    const set: WorkoutSet = {
      id: randomUUID(),
      exerciseName: lift,
      weightKg: Number(weightKg),
      reps: reps ? Number(reps) : null,
      performedAt: new Date().toISOString(),
    }
    addSet.mutate({ label: `${lift} ${describe(set)}`, set })
    onDone()
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.cardTitle}>Log lift</Text>
      <View style={ui.chips}>
        {BIG_FOUR_LIFTS.map((name) => (
          <Chip key={name} label={name} selected={lift === name} onPress={() => setLift(name)} />
        ))}
      </View>
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} numeric />
        <Field label="Reps (optional)" value={reps} onChange={(v) => setReps(v.replace(/\D/g, ''))} keyboardType="number-pad" />
      </View>
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button label="Add" onPress={save} disabled={!(Number(weightKg) > 0)} />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
    </View>
  )
}

// Only the lifts given a value are sent; an emptied field keeps its old goal, as on the web.
function GoalsForm({ goals, onDone }: { goals: Record<string, number>; onDone: () => void }) {
  const setGoals = useQueued<SetLiftGoalsVars>(QUEUED.setLiftGoals)
  const [form, setForm] = useState(() => Object.fromEntries(BIG_FOUR_LIFTS.map((name) => [name, goals[name] ? String(goals[name]) : ''])))

  const changed = Object.fromEntries(
    Object.entries(form)
      .filter(([name, value]) => value !== '' && Number(value) > 0 && Number(value) !== goals[name])
      .map(([name, value]) => [name, Number(value)]),
  )

  const save = () => {
    setGoals.mutate({ label: 'Lift goals', goals: changed })
    onDone()
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.cardTitle}>Lift goals</Text>
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        {BIG_FOUR_LIFTS.map((name) => (
          <Field key={name} label={`${name} (kg)`} value={form[name]} onChange={(v) => setForm({ ...form, [name]: v })} numeric />
        ))}
      </View>
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button label="Save goals" onPress={save} disabled={Object.keys(changed).length === 0} />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 4, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  tileSelected: { borderColor: colors.text, backgroundColor: 'rgba(220, 224, 217, 0.1)' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between' },
  tileValue: { fontSize: 18, fontWeight: '600', color: colors.text },
  rank: { fontWeight: '700', color: colors.text },
  detail: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  strong: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
