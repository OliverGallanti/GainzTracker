import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { startOfLocalDay } from '@gainz/shared/dates'
import { computeWeeklyStreak, suggestedDayIndex, uniqueDays, weeklyGoal } from '@gainz/shared/splits'
import { SPLIT_TEMPLATES } from '@gainz/shared/templates'
import type { SplitLog, WorkoutSet, WorkoutSplit } from '@gainz/shared/types'
import { api } from '../api'
import {
  QUEUED,
  useQueued,
  useUnsyncedIds,
  type AddSetVars,
  type CreateSplitVars,
  type LogDayVars,
  type RemoveVars,
  type TrainingData,
  type UpdateLogVars,
  type UpdateSplitVars,
} from '../queue'
import { colors } from '../theme'
import { Text, Button, Card, Chip, ErrorText, Field, Muted, Screen, Unsynced, styles as ui } from '../ui'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const WEEK = [1, 2, 3, 4, 5, 6, 7]

// Today and the six days before it, as local midnights: the days the logger can fill in.
const recentDays = () => {
  const today = startOfLocalDay()
  return WEEK.map((_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - i))
}
const dayLabel = (date: Date, i: number) =>
  i === 0 ? 'Today' : i === 1 ? 'Yesterday' : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })

export default function TrainingScreen() {
  // Same load as the web card: the streak counts days across every routine, the
  // logger only uses the active one's logs.
  const training = useQuery({
    queryKey: ['training'],
    queryFn: async (): Promise<TrainingData> => {
      const splits = await api<WorkoutSplit[]>('/api/workout-splits')
      const split = splits.find((s) => s.active) ?? null
      const logsBySplit = await Promise.all(splits.map((s) => api<SplitLog[]>(`/api/workout-splits/${s.id}/logs`)))
      return { split, logs: split ? logsBySplit[splits.indexOf(split)] : [], allLogs: logsBySplit.flat() }
    },
  })
  // Shared with Big 4 (same key): a session's exercises are the sets tagged with its log.
  const sets = useQuery({ queryKey: ['workoutSets'], queryFn: () => api<WorkoutSet[]>('/api/workout-sets') })
  const [editingRoutine, setEditingRoutine] = useState(false)
  const [openLogId, setOpenLogId] = useState<string | null>(null)

  const split = training.data?.split
  const logs = training.data?.logs ?? []
  const refresh = () => void Promise.all([training.refetch(), sets.refetch()])

  return (
    <Screen>
      <Card
        title="Training"
        right={split && !editingRoutine ? <Button label="Change routine" variant="small" onPress={() => setEditingRoutine(true)} /> : null}
      >
        {training.isPending && <Muted>Loading…</Muted>}
        {training.isError && <ErrorText onPress={refresh}>Could not load your training: tap to retry</ErrorText>}
        {training.data && (editingRoutine || !split) && (
          <RoutineEditor onDone={split ? () => setEditingRoutine(false) : undefined} />
        )}
        {split && !editingRoutine && training.data && (
          <Logger split={split} logs={logs} allLogs={training.data.allLogs} onLogged={setOpenLogId} />
        )}
      </Card>

      {split && logs.length > 0 && (
        <Card title="Recent days">
          {logs.slice(0, 14).map((log) =>
            openLogId === log.id ? (
              <LogEditor key={log.id} split={split} log={log} sets={sets.data} onClose={() => setOpenLogId(null)} />
            ) : (
              <LogRow key={log.id} split={split} log={log} onEdit={() => setOpenLogId(log.id)} />
            ),
          )}
          <Muted>Removing a day also removes any exercises logged on it.</Muted>
        </Card>
      )}
    </Screen>
  )
}

function Logger({
  split,
  logs,
  allLogs,
  onLogged,
}: {
  split: WorkoutSplit
  logs: SplitLog[]
  allLogs: SplitLog[]
  onLogged: (logId: string) => void
}) {
  const goal = weeklyGoal(split)
  const { streak, thisWeekDays } = computeWeeklyStreak(allLogs, goal)
  const [days] = useState(recentDays)
  const [dayOffset, setDayOffset] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const selected = picked ?? split.days.indexOf(split.days[suggestedDayIndex(split.days, logs)])
  const logDay = useQueued<LogDayVars>(QUEUED.logDay)
  const updateSplit = useQueued<UpdateSplitVars>(QUEUED.updateSplit)

  const target = days[dayOffset]
  const targetLog = logs.find((log) => new Date(log.loggedAt).toDateString() === target.toDateString())

  // Queued (see queue.ts). The day's bounds are fixed now, on the phone: sent
  // after midnight, it still counts for the day it was meant for. A past day is
  // logged at its noon, as on the web.
  const log = (completed: boolean) => {
    const dayEnd = new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1)
    const loggedAt = dayOffset === 0 ? new Date() : new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12)
    const id = randomUUID()
    logDay.mutate({
      label: `${split.days[selected]} (${completed ? 'done' : 'skipped'})`,
      splitId: split.id,
      log: { id, dayIndex: selected, completed, loggedAt: loggedAt.toISOString() },
      dayStart: target.toISOString(),
      dayEnd: dayEnd.toISOString(),
    })
    // Straight on to the exercises, as on the web.
    if (completed) onLogged(id)
  }

  const changeGoal = (daysPerWeek: number) => {
    if (daysPerWeek !== goal) updateSplit.mutate({ label: `Weekly goal ${daysPerWeek}`, splitId: split.id, daysPerWeek })
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.text}>
        <Text style={styles.strong}>{split.name}</Text> · {split.days.join(' → ')}
      </Text>
      <View style={styles.streak} accessible accessibilityLabel={`${streak} week streak, ${thisWeekDays} of ${goal} days this week`}>
        <Text style={styles.streakNumber}>{streak}</Text>
        <View>
          <Text style={ui.text}>{streak === 1 ? 'week' : 'weeks'} streak</Text>
          <Muted>
            {thisWeekDays} of {goal} days this week
          </Muted>
        </View>
      </View>

      <Muted>Weekly goal (days a week)</Muted>
      <View style={ui.chips}>
        {WEEK.map((n) => (
          <Chip key={n} label={String(n)} selected={goal === n} onPress={() => changeGoal(n)} />
        ))}
      </View>

      <Muted>Day</Muted>
      <View style={ui.chips}>
        {days.map((date, i) => (
          <Chip key={i} label={dayLabel(date, i)} selected={dayOffset === i} onPress={() => setDayOffset(i)} />
        ))}
      </View>

      {targetLog ? (
        <Muted>
          {dayLabel(target, dayOffset)}: {split.days[targetLog.dayIndex]} · {targetLog.completed ? 'done' : 'skipped'}. Edit it in
          Recent days below.
        </Muted>
      ) : (
        <>
          <Muted>{dayOffset === 0 ? 'What are you training today?' : `What did you train on ${formatDate(target.toISOString())}?`}</Muted>
          <View style={ui.chips}>
            {uniqueDays(split.days).map(({ label, index }) => (
              <Chip key={index} label={label} selected={selected === index} onPress={() => setPicked(index)} />
            ))}
          </View>
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Button label="Mark done" onPress={() => log(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Mark skipped" variant="secondary" onPress={() => log(false)} />
            </View>
          </View>
        </>
      )}
    </View>
  )
}

function LogRow({ split, log, onEdit }: { split: WorkoutSplit; log: SplitLog; onEdit: () => void }) {
  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const unsynced = useUnsyncedIds()
  const name = `${split.days[log.dayIndex]} on ${formatDate(log.loggedAt)}`

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={ui.text}>{split.days[log.dayIndex]}</Text>
        <Muted>
          {formatDate(log.loggedAt)} · {log.completed ? 'Done' : 'Skipped'}
          {log.durationMinutes ? ` · ${log.durationMinutes} min` : ''}
        </Muted>
        {unsynced.has(log.id) && <Unsynced />}
      </View>
      <Button label="Edit" variant="small" onPress={onEdit} accessibilityLabel={`Edit ${name}`} />
      <Button
        label="Remove"
        variant="small"
        onPress={() =>
          remove.mutate({ label: `Remove ${name}`, path: `/api/workout-splits/${split.id}/logs/${log.id}`, cacheKey: ['training'], id: log.id })
        }
        accessibilityLabel={`Remove ${name}`}
      />
    </View>
  )
}

// A logged day opened up: change which day it was or whether it was done, and
// (when done) its exercises and duration.
function LogEditor({
  split,
  log,
  sets,
  onClose,
}: {
  split: WorkoutSplit
  log: SplitLog
  sets: WorkoutSet[] | undefined
  onClose: () => void
}) {
  const updateLog = useQueued<UpdateLogVars>(QUEUED.updateLog)
  const day = split.days[log.dayIndex]
  const update = (changes: UpdateLogVars['changes'], what: string) =>
    updateLog.mutate({ label: `${day} on ${formatDate(log.loggedAt)}: ${what}`, splitId: split.id, logId: log.id, changes })

  return (
    <View style={styles.editor}>
      <Text style={styles.strong}>{formatDate(log.loggedAt)}</Text>
      <View style={ui.chips}>
        {uniqueDays(split.days).map(({ label, index }) => (
          <Chip
            key={index}
            label={label}
            selected={split.days.indexOf(day) === index}
            onPress={() => split.days.indexOf(day) !== index && update({ dayIndex: index }, label)}
          />
        ))}
      </View>
      <View style={ui.chips}>
        <Chip label="Done" selected={log.completed} onPress={() => !log.completed && update({ completed: true }, 'done')} />
        <Chip label="Skipped" selected={!log.completed} onPress={() => log.completed && update({ completed: false }, 'skipped')} />
      </View>

      {log.completed && sets && <SessionEditor log={log} sets={sets.filter((s) => s.splitLogId === log.id)} onDone={onClose} />}
      {log.completed && !sets && <Muted>Loading exercises…</Muted>}
      {!log.completed && <Button label="Close" variant="secondary" onPress={onClose} />}
    </View>
  )
}

// Form rows hold the inputs' text. A row keeps its set's id until it's edited;
// saving removes the sets whose rows were edited or deleted and adds the new
// rows, so unchanged sets are left alone (and nothing is lost if offline).
type Row = { id?: string; exerciseName: string; weightKg: string; reps: string }
const emptyRow = (): Row => ({ exerciseName: '', weightKg: '', reps: '' })

function SessionEditor({ log, sets, onDone }: { log: SplitLog; sets: WorkoutSet[]; onDone: () => void }) {
  const addSet = useQueued<AddSetVars>(QUEUED.addSet)
  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const updateLog = useQueued<UpdateLogVars>(QUEUED.updateLog)
  const [rows, setRows] = useState<Row[]>(() =>
    sets.length > 0
      ? [...sets].reverse().map((s) => ({ id: s.id, exerciseName: s.exerciseName, weightKg: s.weightKg == null ? '' : String(s.weightKg), reps: s.reps == null ? '' : String(s.reps) }))
      : [emptyRow()],
  )
  const [duration, setDuration] = useState(log.durationMinutes ? String(log.durationMinutes) : '')

  const edit = (index: number, changes: Partial<Row>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...changes, id: undefined } : r)))

  const save = () => {
    const kept = new Set(rows.map((r) => r.id).filter(Boolean))
    for (const s of sets) {
      if (!kept.has(s.id)) {
        remove.mutate({ label: `Remove ${s.exerciseName}`, path: `/api/workout-sets/${s.id}`, cacheKey: ['workoutSets'], id: s.id })
      }
    }
    for (const r of rows) {
      if (r.id || !r.exerciseName.trim()) continue
      const set: WorkoutSet = {
        id: randomUUID(),
        splitLogId: log.id,
        exerciseName: r.exerciseName.trim(),
        weightKg: r.weightKg ? Number(r.weightKg) : null,
        reps: r.reps ? Number(r.reps) : null,
        performedAt: log.loggedAt, // the session's day, so a past day's lifts chart on that day
      }
      addSet.mutate({ label: set.exerciseName, set })
    }
    const minutes = Number(duration)
    if (minutes > 0 && minutes !== log.durationMinutes) {
      updateLog.mutate({ label: `Duration ${minutes} min`, splitId: log.splitId, logId: log.id, changes: { durationMinutes: Math.round(minutes) } })
    }
    onDone()
  }

  return (
    <View style={{ gap: 12 }}>
      <Muted>Exercises</Muted>
      {rows.map((row, index) => (
        <View key={index} style={styles.exercise}>
          <Field label="Exercise" value={row.exerciseName} onChange={(v) => edit(index, { exerciseName: v })} />
          <View style={[ui.row, { alignItems: 'flex-end' }]}>
            <Field label="kg" value={row.weightKg} onChange={(v) => edit(index, { weightKg: v })} numeric />
            <Field label="Reps" value={row.reps} onChange={(v) => edit(index, { reps: v.replace(/\D/g, '') })} keyboardType="number-pad" />
            <Button
              label="✕"
              variant="small"
              onPress={() => setRows(rows.filter((_, i) => i !== index))}
              accessibilityLabel={`Remove ${row.exerciseName || 'exercise'}`}
            />
          </View>
        </View>
      ))}
      <Button label="+ Add exercise" variant="secondary" onPress={() => setRows([...rows, emptyRow()])} />
      <Field label="Duration (minutes)" value={duration} onChange={(v) => setDuration(v.replace(/\D/g, ''))} keyboardType="number-pad" />
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button label="Save session" onPress={save} />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
    </View>
  )
}

// Pick a template or build a custom routine. Saving makes it the active routine;
// the old one's days still count toward the streak.
function RoutineEditor({ onDone }: { onDone?: () => void }) {
  const createSplit = useQueued<CreateSplitVars>(QUEUED.createSplit)
  const [draft, setDraft] = useState<{ name: string; days: string[] } | null>(null)
  const [perWeek, setPerWeek] = useState<number | null>(null) // null until touched: then it follows the number of days

  if (!draft) {
    return (
      <View style={{ gap: 8 }}>
        <Muted>{onDone ? 'Pick a new routine.' : 'Pick a routine to start tracking your weekly streak.'}</Muted>
        {SPLIT_TEMPLATES.map((template) => (
          <Button
            key={template.name}
            label={`${template.name} · ${template.days.join(' → ')}`}
            variant="secondary"
            onPress={() => setDraft({ name: template.name, days: [...template.days] })}
          />
        ))}
        <Button label="Custom" variant="secondary" onPress={() => setDraft({ name: '', days: ['', ''] })} />
        {onDone && <Button label="Cancel" variant="secondary" onPress={onDone} />}
      </View>
    )
  }

  const { name, days } = draft
  const cleaned = days.map((d) => d.trim()).filter(Boolean)
  const daysPerWeek = perWeek ?? Math.min(7, Math.max(1, cleaned.length))
  const setDays = (next: string[]) => setDraft({ name, days: next })
  const move = (index: number, by: number) => {
    const next = [...days]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    setDays(next)
  }

  const save = () => {
    const routine = { id: randomUUID(), name: name.trim() || 'My routine', days: cleaned, daysPerWeek }
    createSplit.mutate({ label: `Routine ${routine.name}`, split: routine })
    onDone?.()
  }

  return (
    <View style={{ gap: 12 }}>
      <Field label="Routine name" value={name} onChange={(v) => setDraft({ name: v, days })} />
      <Muted>Days per week to count as a good week</Muted>
      <View style={ui.chips}>
        {WEEK.map((n) => (
          <Chip key={n} label={String(n)} selected={daysPerWeek === n} onPress={() => setPerWeek(n)} />
        ))}
      </View>
      <Muted>Days (in order)</Muted>
      {days.map((day, index) => (
        <View key={index} style={[ui.row, { alignItems: 'flex-end' }]}>
          <Field label={`Day ${index + 1}`} value={day} onChange={(v) => setDays(days.map((d, i) => (i === index ? v : d)))} placeholder="e.g. Push" />
          <Button label="↑" variant="small" onPress={() => move(index, -1)} disabled={index === 0} accessibilityLabel={`Move day ${index + 1} up`} />
          <Button
            label="↓"
            variant="small"
            onPress={() => move(index, 1)}
            disabled={index === days.length - 1}
            accessibilityLabel={`Move day ${index + 1} down`}
          />
          <Button label="✕" variant="small" onPress={() => setDays(days.filter((_, i) => i !== index))} accessibilityLabel={`Remove day ${index + 1}`} />
        </View>
      ))}
      <Button label="+ Add day" variant="secondary" onPress={() => setDays([...days, ''])} />
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button label="Save routine" onPress={save} disabled={cleaned.length === 0} />
        </View>
        <Button label={onDone ? 'Cancel' : 'Back'} variant="secondary" onPress={onDone ?? (() => setDraft(null))} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  strong: { fontWeight: '600', color: colors.text },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakNumber: { fontSize: 36, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editor: { gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.text },
  exercise: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
})
