import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { useKeepAwake } from 'expo-keep-awake'
import { describeTiming, formatSeconds } from '@gainz/shared/sessions'
import type { WorkoutSet } from '@gainz/shared/types'
import { Check, Play, Plus, X } from '../icons'
import { QUEUED, useQueued, type AddSetVars, type UpdateLogVars } from '../queue'
import { colors } from '../theme'
import { Text, Button, Chip, Field, IconButton, Muted, Sheet, styles as ui, animateLayout } from '../ui'
import { setWorkout, since, useNow, useWorkout, type LiveSet, type Workout } from '../workout'

const REST_TARGETS = [60, 90, 120, 180]
const num = (text: string) => (text.trim() && Number.isFinite(Number(text)) ? Number(text) : null)

// The workout in progress, full screen. Closing it only minimises it (the bar
// above the tabs brings it back); Finish or Cancel ends it.
export default function LiveWorkout() {
  const workout = useWorkout()
  if (!workout) return null
  return (
    <Sheet visible={workout.open} title={workout.day} onClose={() => setWorkout({ ...workout, open: false })}>
      <Session workout={workout} />
    </Sheet>
  )
}

function Session({ workout }: { workout: Workout }) {
  useKeepAwake() // the screen stays on while the workout is open
  const now = useNow()
  const addSet = useQueued<AddSetVars>(QUEUED.addSet)
  const updateLog = useQueued<UpdateLogVars>(QUEUED.updateLog)
  const [newExercise, setNewExercise] = useState('')
  const { running, restStartedAt, restTarget } = workout
  const rest = restStartedAt != null && !running ? since(restStartedAt, now) : null

  const change = (next: Partial<Workout>) => setWorkout({ ...workout, ...next })
  const changeSet = (e: number, s: number, patch: Partial<LiveSet>, rest: Partial<Workout> = {}) =>
    change({
      ...rest,
      exercises: workout.exercises.map((ex, i) => (i === e ? { ...ex, sets: ex.sets.map((set, j) => (j === s ? { ...set, ...patch } : set)) } : ex)),
    })

  const start = (e: number, s: number) => change({ running: { exercise: e, set: s, startedAt: Date.now() } })

  // The set goes to the server (through the queue) as soon as it's done; the
  // rest clock starts from here.
  const done = (e: number, s: number) => {
    if (!running) return
    const t = Date.now()
    const exercise = workout.exercises[e]
    const row = exercise.sets[s]
    const timing = {
      durationSeconds: since(running.startedAt, t),
      restSeconds: restStartedAt != null ? since(restStartedAt, running.startedAt) : null,
    }
    const set: WorkoutSet = {
      id: randomUUID(),
      splitLogId: workout.logId,
      exerciseName: exercise.name,
      weightKg: num(row.weightKg),
      reps: num(row.reps),
      ...timing,
      performedAt: new Date(t).toISOString(),
    }
    addSet.mutate({ label: `${exercise.name} set ${s + 1}`, set })
    changeSet(e, s, { done: timing }, { running: null, restStartedAt: t })
  }

  const addSetRow = (e: number) => {
    const last = workout.exercises[e].sets.at(-1)
    animateLayout(() =>
      change({ exercises: workout.exercises.map((ex, i) => (i === e ? { ...ex, sets: [...ex.sets, { weightKg: last?.weightKg ?? '', reps: last?.reps ?? '' }] } : ex)) }),
    )
  }
  const removeSetRow = (e: number, s: number) =>
    animateLayout(() =>
      change({
        exercises: workout.exercises
          .map((ex, i) => (i === e ? { ...ex, sets: ex.sets.filter((_, j) => j !== s) } : ex))
          .filter((ex) => ex.sets.length > 0),
      }),
    )
  const addExercise = () => {
    const name = newExercise.trim()
    if (!name) return
    animateLayout(() => change({ exercises: [...workout.exercises, { name, sets: [{ weightKg: '', reps: '' }] }] }))
    setNewExercise('')
  }

  const finish = () => {
    const minutes = Math.max(1, Math.round((Date.now() - workout.startedAt) / 60000))
    updateLog.mutate({ label: `${workout.day}: ${minutes} min`, splitId: workout.splitId, logId: workout.logId, changes: { durationMinutes: minutes } })
    setWorkout(null)
  }
  const cancel = () =>
    Alert.alert('Cancel workout?', 'Sets you already finished stay saved; the workout time is not.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Cancel workout', style: 'destructive', onPress: () => setWorkout(null) },
    ])

  return (
    <View style={{ gap: 16 }}>
      <View style={ui.row}>
        <View style={styles.clock} accessible accessibilityLabel={`Workout time ${formatSeconds(since(workout.startedAt, now))}`}>
          <Muted>Workout</Muted>
          <Text style={styles.clockNumber}>{formatSeconds(since(workout.startedAt, now))}</Text>
        </View>
        <View
          style={[styles.clock, rest != null && rest >= restTarget && styles.restOver]}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={rest == null ? 'Rest clock' : rest >= restTarget ? 'Rest over' : `Rest ${formatSeconds(rest)} of ${formatSeconds(restTarget)}`}
        >
          <Text style={rest != null && rest >= restTarget ? styles.restOverText : ui.muted}>
            {rest == null ? 'Rest' : rest >= restTarget ? 'Rest over' : `Rest of ${formatSeconds(restTarget)}`}
          </Text>
          <Text style={[styles.clockNumber, rest != null && rest >= restTarget && styles.restOverText]}>{rest == null ? '–' : formatSeconds(rest)}</Text>
        </View>
      </View>
      <View style={ui.chips}>
        {REST_TARGETS.map((seconds) => (
          <Chip
            key={seconds}
            label={formatSeconds(seconds)}
            selected={restTarget === seconds}
            onPress={() => change({ restTarget: seconds })}
            accessibilityLabel={`Rest ${seconds} seconds`}
          />
        ))}
      </View>

      {workout.exercises.length === 0 && <Muted>Add your first exercise below. Next time this day is filled in from today.</Muted>}

      {workout.exercises.map((exercise, e) => (
        <View key={e} style={styles.exercise}>
          <Text style={styles.strong} accessibilityRole="header">
            {exercise.name}
          </Text>
          {exercise.sets.map((set, s) => {
            const isRunning = running?.exercise === e && running.set === s
            if (set.done) {
              return (
                <View key={s} style={styles.doneRow}>
                  <Check size={16} color={colors.text} />
                  <Text style={[ui.text, { flex: 1 }]}>
                    {s + 1}. {set.weightKg || '–'} kg × {set.reps || '–'}
                  </Text>
                  <Muted>{describeTiming(set.done)}</Muted>
                </View>
              )
            }
            return (
              <View key={s} style={[styles.setRow, isRunning && styles.setRunning]}>
                <Text style={styles.setNumber}>{s + 1}</Text>
                <Field label="kg" value={set.weightKg} onChange={(v) => changeSet(e, s, { weightKg: v })} numeric />
                <Field label="Reps" value={set.reps} onChange={(v) => changeSet(e, s, { reps: v.replace(/\D/g, '') })} keyboardType="number-pad" />
                {isRunning ? (
                  <View style={styles.setAction}>
                    <Text style={styles.strong}>{formatSeconds(since(running.startedAt, now))}</Text>
                    <Button label="Done" icon={Check} variant="small" onPress={() => done(e, s)} accessibilityLabel={`Done, ${exercise.name} set ${s + 1}`} />
                  </View>
                ) : (
                  <View style={styles.setAction}>
                    <Button
                      label="Start"
                      icon={Play}
                      variant="small"
                      onPress={() => start(e, s)}
                      disabled={running != null}
                      accessibilityLabel={`Start ${exercise.name} set ${s + 1}`}
                    />
                    <IconButton icon={X} label={`Remove ${exercise.name} set ${s + 1}`} onPress={() => removeSetRow(e, s)} />
                  </View>
                )}
              </View>
            )
          })}
          <Button label="Add set" icon={Plus} variant="small" onPress={() => addSetRow(e)} accessibilityLabel={`Add a set of ${exercise.name}`} />
        </View>
      ))}

      <View style={[ui.row, { alignItems: 'flex-end' }]}>
        <Field label="New exercise" value={newExercise} onChange={setNewExercise} onSubmitEditing={addExercise} returnKeyType="done" />
        <Button label="Add" icon={Plus} variant="secondary" onPress={addExercise} disabled={!newExercise.trim()} />
      </View>

      <Button label="Finish workout" icon={Check} onPress={finish} disabled={running != null} />
      <Button label="Cancel workout" variant="secondary" onPress={cancel} />
    </View>
  )
}

const styles = StyleSheet.create({
  strong: { fontWeight: '600', color: colors.text },
  clock: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.card, gap: 2 },
  clockNumber: { fontSize: 28, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  restOver: { backgroundColor: colors.text },
  restOverText: { color: colors.main, fontWeight: '700' },
  exercise: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  setRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 4, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  setRunning: { borderColor: colors.text },
  setNumber: { width: 16, paddingBottom: 12, color: colors.muted, textAlign: 'center' },
  setAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4 },
})
