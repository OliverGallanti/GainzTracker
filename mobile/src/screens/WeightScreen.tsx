import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { computeBmi } from '@gainz/shared/body'
import { api } from '../api'
import { QUEUED, useQueued, type AddWeightVars, type UpdateMeVars } from '../queue'
import { useMe, useWeights } from '../queries'
import { Button, Card, ErrorText, Field, Muted, Screen, styles as ui } from '../ui'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function WeightScreen() {
  const queryClient = useQueryClient()
  const me = useMe()
  const weights = useWeights()
  const [logging, setLogging] = useState(false)

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/weights/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weights'] }),
  })

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

      {entries.length > 0 && (
        <Card title="History">
          {entries.slice(0, 30).map((entry) => (
            <View key={entry.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={ui.text}>
                  {entry.weightKg} kg{entry.bodyFatPercent != null ? ` · ${entry.bodyFatPercent}%` : ''}
                </Text>
                <Muted>{formatDate(entry.loggedAt)}</Muted>
              </View>
              <Button
                label="Remove"
                variant="small"
                onPress={() => remove.mutate(entry.id)}
                disabled={remove.isPending}
                accessibilityLabel={`Remove ${entry.weightKg} kg from ${formatDate(entry.loggedAt)}`}
              />
            </View>
          ))}
          {remove.isError && <ErrorText>Could not remove that entry: please try again</ErrorText>}
        </Card>
      )}
    </Screen>
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
