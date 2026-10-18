import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { computeBmi } from '@gainz/shared/body'
import { api } from '../api'
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
function LogWeightForm({ askHeight, onDone }: { askHeight: boolean; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ weightKg: '', bodyFatPercent: '', heightCm: '' })
  const [id] = useState(() => randomUUID())

  const save = useMutation({
    // Height first: repeating that PUT is harmless, while the weight carries an id
    // so a retry can't log it twice.
    mutationFn: async () => {
      if (askHeight && form.heightCm) {
        await api('/api/me', { method: 'PUT', body: JSON.stringify({ heightCm: Number(form.heightCm) }) })
      }
      await api('/api/weights', {
        method: 'POST',
        body: JSON.stringify({
          id,
          weightKg: Number(form.weightKg),
          ...(form.bodyFatPercent ? { bodyFatPercent: Number(form.bodyFatPercent) } : {}),
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weights'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      onDone()
    },
  })

  return (
    <View style={{ gap: 12 }}>
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        <Field label="Weight (kg)" value={form.weightKg} onChange={(v) => setForm({ ...form, weightKg: v })} numeric />
        <Field label="Body fat % (optional)" value={form.bodyFatPercent} onChange={(v) => setForm({ ...form, bodyFatPercent: v })} numeric />
        {askHeight && <Field label="Height (cm)" value={form.heightCm} onChange={(v) => setForm({ ...form, heightCm: v })} numeric />}
      </View>
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button
            label={save.isPending ? 'Saving…' : 'Save'}
            onPress={() => save.mutate()}
            disabled={!(Number(form.weightKg) > 0) || save.isPending}
          />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
      {save.isError && <ErrorText>Could not save that weight: please try again</ErrorText>}
    </View>
  )
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '600', color: '#dce0d9' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
