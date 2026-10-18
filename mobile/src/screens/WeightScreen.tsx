import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { computeBmi } from '@gainz/shared/body'
import type { WeightEntry } from '@gainz/shared/types'
import LineChart from '../LineChart'
import { QUEUED, useQueued, useUnsyncedIds, type AddWeightVars, type RemoveVars, type UpdateMeVars } from '../queue'
import { useMe, useWeights } from '../queries'
import { Text, Button, Card, Chip, ErrorText, Field, Muted, Screen, Unsynced, styles as ui } from '../ui'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function WeightScreen() {
  const me = useMe()
  const weights = useWeights()
  const [logging, setLogging] = useState(false)
  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const unsynced = useUnsyncedIds()

  const entries = weights.data ?? [] // newest first
  const latest = entries[0]
  const latestBodyFat = entries.find((e) => e.bodyFatPercent != null)?.bodyFatPercent
  const height = me.data?.heightCm ?? null
  const bmi = latest ? computeBmi(latest.weightKg, height) : null
  const goals = [me.data?.weightGoalKg && `${me.data.weightGoalKg} kg`, me.data?.bodyFatGoalPercent && `${me.data.bodyFatGoalPercent}% body fat`]
    .filter(Boolean)
    .join(' · ')

  return (
    <Screen refreshing={weights.isRefetching} onRefresh={() => void Promise.all([weights.refetch(), me.refetch()])}>
      <Card title="Weight">
        {(weights.isPending || me.isPending) && <Muted>Loading…</Muted>}
        {(weights.isError || me.isError) && (
          <ErrorText onPress={() => void Promise.all([weights.refetch(), me.refetch()])}>
            Could not load your weight: tap to retry
          </ErrorText>
        )}

        {weights.data && me.data && (
          <>
            <View style={styles.stats}>
              <Stat label="Latest" value={latest ? `${latest.weightKg} kg` : '–'} />
              <Stat label="Body fat" value={latestBodyFat != null ? `${latestBodyFat}%` : '–'} />
              <Stat label="BMI" value={bmi != null ? bmi.toFixed(1) : '–'} />
            </View>
            {goals ? <Muted>Goal: {goals}</Muted> : null}
            {logging ? (
              <LogWeightForm askHeight={height == null} onDone={() => setLogging(false)} />
            ) : (
              <Button label="Log weight" onPress={() => setLogging(true)} />
            )}
          </>
        )}
      </Card>

      {entries.length > 0 && me.data && (
        <ProgressChart entries={entries} weightGoal={me.data.weightGoalKg} bodyFatGoal={me.data.bodyFatGoalPercent} />
      )}

      {entries.length > 0 && (
        <Card title="History">
          {entries.slice(0, 30).map((entry) => (
            <View key={entry.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={ui.text}>
                  {entry.weightKg} kg{entry.bodyFatPercent != null ? ` · ${entry.bodyFatPercent}%` : ''}
                </Text>
                <Muted>{formatDate(entry.loggedAt)}</Muted>
                {unsynced.has(entry.id) && <Unsynced />}
              </View>
              <Button
                label="Remove"
                variant="small"
                onPress={() =>
                  remove.mutate({ label: `Remove ${entry.weightKg} kg`, path: `/api/weights/${entry.id}`, cacheKey: ['weights'], id: entry.id })
                }
                accessibilityLabel={`Remove ${entry.weightKg} kg from ${formatDate(entry.loggedAt)}`}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  )
}

const RANGES = [
  { key: '1M', days: 30 },
  { key: '3M', days: 90 },
  { key: '6M', days: 182 },
  { key: '1Y', days: 365 },
  { key: 'All', days: null },
] as const

// Weight or body fat over a chosen window; the stats above always use the full history.
function ProgressChart({
  entries,
  weightGoal,
  bodyFatGoal,
}: {
  entries: WeightEntry[]
  weightGoal: number | null
  bodyFatGoal: number | null
}) {
  const [series, setSeries] = useState<'weight' | 'bodyFat'>('weight')
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('1Y')
  // Pinned once per mount so the window doesn't drift between renders.
  const [now] = useState(() => Date.now())

  const days = RANGES.find((r) => r.key === range)!.days
  const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : null
  const inRange = [...entries].reverse().filter((e) => !cutoff || new Date(e.loggedAt).getTime() >= cutoff) // oldest first
  const hasBodyFat = entries.some((e) => e.bodyFatPercent != null)
  const points =
    series === 'weight'
      ? inRange.map((e) => ({ loggedAt: e.loggedAt, value: e.weightKg }))
      : inRange.flatMap((e) => (e.bodyFatPercent != null ? [{ loggedAt: e.loggedAt, value: e.bodyFatPercent }] : []))

  return (
    <Card title="Progress">
      {hasBodyFat && (
        <View style={ui.chips}>
          <Chip label="Weight" selected={series === 'weight'} onPress={() => setSeries('weight')} />
          <Chip label="Body fat" selected={series === 'bodyFat'} onPress={() => setSeries('bodyFat')} />
        </View>
      )}
      <View style={ui.chips}>
        {RANGES.map((r) => (
          <Chip key={r.key} label={r.key} selected={range === r.key} onPress={() => setRange(r.key)} />
        ))}
      </View>
      {points.length === 0 ? (
        <Muted>Nothing logged in this range.</Muted>
      ) : series === 'weight' ? (
        <LineChart data={points} unit="kg" goal={weightGoal} label="Weight" />
      ) : (
        <LineChart data={points} unit="%" goal={bodyFatGoal} label="Body fat" />
      )}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Muted>{label}</Muted>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

// Height is asked for only while it's missing: BMI and the calorie estimate need it.
// Both writes are queued (see queue.ts), height first: one queue, sent in order.
function LogWeightForm({ askHeight, onDone }: { askHeight: boolean; onDone: () => void }) {
  const [form, setForm] = useState({ weightKg: '', bodyFatPercent: '', heightCm: '' })
  const updateMe = useQueued<UpdateMeVars>(QUEUED.updateMe)
  const addWeight = useQueued<AddWeightVars>(QUEUED.addWeight)

  const save = () => {
    if (askHeight && form.heightCm) {
      updateMe.mutate({ label: 'Height', changes: { heightCm: Number(form.heightCm) } })
    }
    const entry = {
      id: randomUUID(),
      weightKg: Number(form.weightKg),
      bodyFatPercent: form.bodyFatPercent ? Number(form.bodyFatPercent) : null,
      loggedAt: new Date().toISOString(),
    }
    addWeight.mutate({ label: `${entry.weightKg} kg`, entry })
    onDone()
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        <Field label="Weight (kg)" value={form.weightKg} onChange={(v) => setForm({ ...form, weightKg: v })} numeric />
        <Field label="Body fat % (optional)" value={form.bodyFatPercent} onChange={(v) => setForm({ ...form, bodyFatPercent: v })} numeric />
        {askHeight && <Field label="Height (cm)" value={form.heightCm} onChange={(v) => setForm({ ...form, heightCm: v })} numeric />}
      </View>
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button label="Save" onPress={save} disabled={!(Number(form.weightKg) > 0)} />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '600', color: '#dce0d9' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
