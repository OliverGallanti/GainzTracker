import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { buildMonthGrid, startOfLocalDay } from '@gainz/shared/dates'
import { describeTiming } from '@gainz/shared/sessions'
import { computeWeeklyStreak, suggestedDayIndex, uniqueDays, weeklyGoal } from '@gainz/shared/splits'
import { SPLIT_TEMPLATES } from '@gainz/shared/templates'
import type { SplitLog, WorkoutSet, WorkoutSplit } from '@gainz/shared/types'
import { api } from '../api'
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, History, Plus, Repeat, Target, Timer, X } from '../icons'
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
import { Text, Button, Card, Chip, ErrorText, Field, IconButton, Muted, Screen, Sheet, Unsynced, styles as ui, animateLayout, useAnimatedState } from '../ui'
import { setWorkout, startWorkout, useWorkout } from '../workout'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const WEEK = [1, 2, 3, 4, 5, 6, 7]
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const REMOVE_NOTE = 'Removing a day also removes any exercises logged on it.'

export default function TrainingScreen() {
  // Same load as the web card: the streak counts days across every routine, the
  // logger only uses the active one's logs.
  const training = useQuery({
    queryKey: ['training'],
    queryFn: async (): Promise<TrainingData> => {
      const [splits, allLogs] = await Promise.all([api<WorkoutSplit[]>('/api/workout-splits'), api<SplitLog[]>('/api/workout-splits/logs')])
      const split = splits.find((s) => s.active) ?? null
      return { split, logs: split ? allLogs.filter((log) => log.splitId === split.id) : [], allLogs }
    },
  })
  // Shared with Big 4 (same key): a session's exercises are the sets tagged with its log.
  const sets = useQuery({ queryKey: ['workoutSets'], queryFn: () => api<WorkoutSet[]>('/api/workout-sets') })
  const [editingRoutine, setEditingRoutine] = useAnimatedState(false)
  const [openLogId, setOpenLogId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const split = training.data?.split
  const logs = training.data?.logs ?? []
  const openLog = logs.find((log) => log.id === openLogId)
  const refresh = () => void Promise.all([training.refetch(), sets.refetch()])
  // A day opened from the history goes back to it; one opened from the calendar just closes.
  const closeSheet = () => (openLog ? setOpenLogId(null) : setHistoryOpen(false))

  return (
    <Screen>
      {!training.data && (
        <Card title="Training">
          {training.isPending && <Muted>Loading…</Muted>}
          {training.isLoadingError && <ErrorText onPress={refresh}>Could not load your training: tap to retry</ErrorText>}
        </Card>
      )}

      {training.data && (editingRoutine || !split) && (
        <Card title={split ? 'Change routine' : 'Choose a routine'}>
          <RoutineEditor onDone={split ? () => setEditingRoutine(false) : undefined} />
        </Card>
      )}

      {split && !editingRoutine && training.data && (
        <>
          <RoutineSummary split={split} allLogs={training.data.allLogs} onChange={() => setEditingRoutine(true)} />
          <Logger split={split} logs={logs} sets={sets.data} onOpenLog={setOpenLogId} onOpenHistory={() => setHistoryOpen(true)} />
        </>
      )}

      {split && (
        <Sheet visible={historyOpen || !!openLog} title={openLog ? formatDate(openLog.loggedAt) : 'Recent days'} onClose={closeSheet}>
          {openLog ? (
            <LogEditor key={openLog.id} split={split} log={openLog} sets={sets.data} onClose={closeSheet} />
          ) : (
            <>
              {logs.slice(0, 14).map((log) => (
                <LogRow key={log.id} split={split} log={log} onEdit={() => setOpenLogId(log.id)} />
              ))}
              <Muted>{REMOVE_NOTE}</Muted>
            </>
          )}
        </Sheet>
      )}
    </Screen>
  )
}

function RoutineSummary({ split, allLogs, onChange }: { split: WorkoutSplit; allLogs: SplitLog[]; onChange: () => void }) {
  const updateSplit = useQueued<UpdateSplitVars>(QUEUED.updateSplit)
  const [editingGoal, setEditingGoal] = useAnimatedState(false)
  const goal = weeklyGoal(split)
  const { streak, thisWeekDays } = computeWeeklyStreak(allLogs, goal)

  const changeGoal = (daysPerWeek: number) => {
    setEditingGoal(false)
    if (daysPerWeek !== goal) updateSplit.mutate({ label: `Weekly goal ${daysPerWeek}`, splitId: split.id, daysPerWeek })
  }

  return (
    <Card title={split.name} right={<Button label="Change routine" icon={Repeat} variant="small" onPress={onChange} />}>
      <Muted>{split.days.join(' → ')}</Muted>
      <View style={ui.row}>
        <View style={styles.stat} accessible accessibilityLabel={`${streak} week streak`}>
          <Text style={styles.statNumber}>{streak}</Text>
          <Muted>{streak === 1 ? 'week' : 'weeks'} streak</Muted>
        </View>
        <View style={styles.stat} accessible accessibilityLabel={`${thisWeekDays} of ${goal} days this week`}>
          <View style={styles.statValue}>
            <Text style={styles.statNumber}>
              {thisWeekDays}
              <Text style={styles.statOf}> / {goal}</Text>
            </Text>
            {thisWeekDays >= goal && <Check size={20} color={colors.text} />}
          </View>
          <Muted>days this week</Muted>
        </View>
      </View>
      {editingGoal ? (
        <View style={{ gap: 8 }}>
          <Muted>Days a week for a good week</Muted>
          <DaysPerWeek value={goal} onChange={changeGoal} />
        </View>
      ) : (
        <Button label="Change weekly goal" icon={Target} variant="small" onPress={() => setEditingGoal(true)} />
      )}
    </Card>
  )
}

// Seven equal cells, so the row always fits on one line.
function DaysPerWeek({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <View style={styles.week}>
      {WEEK.map((n) => (
        <Chip
          key={n}
          label={String(n)}
          selected={value === n}
          onPress={() => onChange(n)}
          style={styles.weekCell}
          accessibilityLabel={`${n} ${n === 1 ? 'day' : 'days'} a week`}
        />
      ))}
    </View>
  )
}

// A big tappable choice: a routine day, or a template.
function Tile({
  title,
  subtitle,
  selected = false,
  half = false,
  onPress,
}: {
  title: string
  subtitle?: string
  selected?: boolean
  half?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.tile, half && styles.tileHalf, selected && ui.chipSelected]}
    >
      <Text style={selected ? ui.chipTextSelected : styles.strong}>{title}</Text>
      {subtitle && <Text style={[styles.tileSubtitle, selected && { color: colors.main }]}>{subtitle}</Text>}
    </Pressable>
  )
}

// The month, as on the web: done and skipped days filled in, any past day can be
// picked, future ones can't. Tapping today or the picked day goes back to today.
function Calendar({ logs, selected, onSelect }: { logs: SplitLog[]; selected: Date; onSelect: (date: Date | null) => void }) {
  const today = startOfLocalDay()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const logsByDate = new Map(logs.map((log) => [new Date(log.loggedAt).toDateString(), log]))
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const turn = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1))

  return (
    <View>
      <View style={styles.monthHeader}>
        <IconButton icon={ChevronLeft} label="Previous month" onPress={() => turn(-1)} />
        <Text style={styles.strong} accessibilityRole="header">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <IconButton icon={ChevronRight} label="Next month" onPress={() => turn(1)} disabled={isCurrentMonth} />
      </View>
      <View style={styles.grid}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={[styles.cell, styles.weekday]}>
            {label}
          </Text>
        ))}
        {buildMonthGrid(month).map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />
          const key = date.toDateString()
          const log = logsByDate.get(key)
          const isToday = key === today.toDateString()
          const isSelected = key === selected.toDateString()
          const future = date > today
          return (
            <Pressable
              key={i}
              onPress={() => onSelect(isToday || isSelected ? null : date)}
              disabled={future}
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(date.toISOString())}${log ? (log.completed ? ', done' : ', skipped') : ''}`}
              accessibilityState={{ selected: isSelected, disabled: future }}
              style={[styles.cell, styles.day, isToday && styles.dayToday, isSelected && styles.daySelected]}
            >
              <View style={[styles.dayFill, log && (log.completed ? styles.dayDone : styles.daySkipped)]}>
                <Text style={log ? styles.dayTextLogged : future ? styles.dayTextFuture : ui.muted}>{date.getDate()}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function Logger({
  split,
  logs,
  sets,
  onOpenLog,
  onOpenHistory,
}: {
  split: WorkoutSplit
  logs: SplitLog[]
  sets: WorkoutSet[] | undefined
  onOpenLog: (logId: string) => void
  onOpenHistory: () => void
}) {
  const [pickedDate, setPickedDate] = useAnimatedState<Date | null>(null) // null: today
  const [picked, setPicked] = useState<number | null>(null)
  const suggested = split.days.indexOf(split.days[suggestedDayIndex(split.days, logs)])
  const selected = picked ?? suggested
  const logDay = useQueued<LogDayVars>(QUEUED.logDay)
  const workout = useWorkout()

  const target = pickedDate ?? startOfLocalDay()
  const targetLog = logs.find((log) => new Date(log.loggedAt).toDateString() === target.toDateString())

  // Queued (see queue.ts). The day's bounds are fixed now, on the phone: sent
  // after midnight, it still counts for the day it was meant for. A past day is
  // logged at its noon, as on the web.
  const log = (completed: boolean, live = false) => {
    const dayEnd = new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1)
    const loggedAt = pickedDate ? new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12) : new Date()
    const id = randomUUID()
    logDay.mutate({
      label: `${split.days[selected]} (${completed ? 'done' : 'skipped'})`,
      splitId: split.id,
      log: { id, dayIndex: selected, completed, loggedAt: loggedAt.toISOString() },
      dayStart: target.toISOString(),
      dayEnd: dayEnd.toISOString(),
    })
    // Straight on to the exercises, as on the web, or the live workout.
    if (live) startWorkout(split, { id, dayIndex: selected, durationMinutes: null }, logs, sets ?? [])
    else if (completed) onOpenLog(id)
  }

  // Only today can be trained live. One workout at a time: while one is going,
  // this takes you back to it.
  const live = !pickedDate && (!targetLog || targetLog.completed)
  const liveButton = workout ? (
    <Button label={`Back to ${workout.day} workout`} icon={Timer} onPress={() => setWorkout({ ...workout, open: true })} />
  ) : (
    <Button
      label={targetLog ? 'Continue workout' : 'Start workout'}
      icon={Timer}
      disabled={!sets}
      onPress={() => (targetLog ? startWorkout(split, targetLog, logs, sets ?? []) : log(true, true))}
    />
  )

  return (
    <Card>
      <Calendar logs={logs} selected={target} onSelect={setPickedDate} />
      <View style={styles.legend}>
        <View style={[styles.legendSwatch, styles.dayDone]} />
        <Muted>Done</Muted>
        <View style={[styles.legendSwatch, styles.daySkipped]} />
        <Muted>Skipped</Muted>
        <View style={{ flex: 1 }} />
        {logs.length > 0 && <Button label="Recent days" icon={History} variant="small" onPress={onOpenHistory} />}
      </View>

      <View style={styles.divider} />

      {targetLog ? (
        <>
          <LogRow split={split} log={targetLog} onEdit={() => onOpenLog(targetLog.id)} />
          {live && liveButton}
          <Muted>{REMOVE_NOTE}</Muted>
        </>
      ) : (
        <>
          <Text style={styles.question} accessibilityRole="header">
            {pickedDate ? `What did you train on ${formatDate(target.toISOString())}?` : 'What are you training today?'}
          </Text>
          <View style={ui.chips}>
            {uniqueDays(split.days).map(({ label, index }) => (
              <Tile
                key={index}
                half
                title={label}
                subtitle={index === suggested ? 'Up next' : undefined}
                selected={selected === index}
                onPress={() => setPicked(index)}
              />
            ))}
          </View>
          {live && liveButton}
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Button label="Mark done" icon={Check} variant={live ? 'secondary' : 'primary'} onPress={() => log(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Mark skipped" variant="secondary" onPress={() => log(false)} />
            </View>
          </View>
        </>
      )}
    </Card>
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
    <View style={{ gap: 12 }}>
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
type Row = { id?: string; exerciseName: string; weightKg: string; reps: string; kept?: Pick<WorkoutSet, 'rpe' | 'durationSeconds' | 'restSeconds' | 'performedAt'> }
const emptyRow = (): Row => ({ exerciseName: '', weightKg: '', reps: '' })

function SessionEditor({ log, sets, onDone }: { log: SplitLog; sets: WorkoutSet[]; onDone: () => void }) {
  const addSet = useQueued<AddSetVars>(QUEUED.addSet)
  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const updateLog = useQueued<UpdateLogVars>(QUEUED.updateLog)
  const [rows, setRows] = useState<Row[]>(() =>
    sets.length > 0
      ? [...sets].reverse().map((s) => ({
          id: s.id,
          exerciseName: s.exerciseName,
          weightKg: s.weightKg == null ? '' : String(s.weightKg),
          reps: s.reps == null ? '' : String(s.reps),
          kept: { rpe: s.rpe, durationSeconds: s.durationSeconds, restSeconds: s.restSeconds, performedAt: s.performedAt }, // what the form doesn't show, kept through an edit
        }))
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
        ...r.kept,
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
            <IconButton icon={X} label={`Remove ${row.exerciseName || 'exercise'}`} onPress={() => animateLayout(() => setRows(rows.filter((_, i) => i !== index)))} />
          </View>
          {row.kept && describeTiming(row.kept) !== '' && <Muted>{describeTiming(row.kept)}</Muted>}
        </View>
      ))}
      <Button label="Add exercise" icon={Plus} variant="secondary" onPress={() => animateLayout(() => setRows([...rows, emptyRow()]))} />
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
          <Tile
            key={template.name}
            title={template.name}
            subtitle={template.days.join(' → ')}
            onPress={() => animateLayout(() => setDraft({ name: template.name, days: [...template.days] }))}
          />
        ))}
        <Tile title="Custom" subtitle="Name your own days" onPress={() => animateLayout(() => setDraft({ name: '', days: ['', ''] }))} />
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
    <View style={{ gap: 16 }}>
      <Field label="Routine name" value={name} onChange={(v) => setDraft({ name: v, days })} />
      <View style={{ gap: 8 }}>
        <Muted>Days a week for a good week</Muted>
        <DaysPerWeek value={daysPerWeek} onChange={setPerWeek} />
      </View>
      <View style={{ gap: 8 }}>
        <Muted>Days, in order</Muted>
        {days.map((day, index) => (
          <View key={index} style={styles.dayRow}>
            <Text style={styles.dayNumber}>{index + 1}</Text>
            <TextInput
              value={day}
              onChangeText={(v) => setDays(days.map((d, i) => (i === index ? v : d)))}
              placeholder="e.g. Push"
              placeholderTextColor={colors.muted}
              accessibilityLabel={`Day ${index + 1}`}
              style={[ui.input, { flex: 1 }]}
            />
            <IconButton icon={ChevronUp} label={`Move day ${index + 1} up`} onPress={() => move(index, -1)} disabled={index === 0} />
            <IconButton icon={ChevronDown} label={`Move day ${index + 1} down`} onPress={() => move(index, 1)} disabled={index === days.length - 1} />
            <IconButton icon={X} label={`Remove day ${index + 1}`} onPress={() => animateLayout(() => setDays(days.filter((_, i) => i !== index)))} />
          </View>
        ))}
        <Button label="Add day" icon={Plus} variant="secondary" onPress={() => animateLayout(() => setDays([...days, '']))} />
      </View>
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button label="Save routine" onPress={save} disabled={cleaned.length === 0} />
        </View>
        <Button label="Back" variant="secondary" onPress={() => animateLayout(() => setDraft(null))} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  strong: { fontWeight: '600', color: colors.text },
  question: { fontSize: 16, fontWeight: '600', color: colors.text },
  stat: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.main },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statNumber: { fontSize: 28, fontWeight: '700', color: colors.text },
  statOf: { fontSize: 18, fontWeight: '500', color: colors.muted },
  week: { flexDirection: 'row', gap: 6 },
  weekCell: { flex: 1, paddingHorizontal: 0, alignItems: 'center' },
  tile: { minHeight: 56, justifyContent: 'center', gap: 2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  tileHalf: { flexGrow: 1, flexBasis: '45%' },
  tileSubtitle: { color: colors.muted, fontSize: 13 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', height: 42 }, // a seventh, rounded down so seven always fit a row
  weekday: { height: 24, textAlign: 'center', color: colors.muted, fontSize: 12 },
  day: { padding: 2, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  dayToday: { borderColor: colors.border },
  daySelected: { borderColor: colors.text },
  dayFill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  dayDone: { backgroundColor: colors.text },
  daySkipped: { backgroundColor: 'rgba(251, 191, 36, 0.8)' },
  dayTextLogged: { color: colors.main, fontWeight: '600' },
  dayTextFuture: { color: 'rgba(220, 224, 217, 0.3)' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3, marginLeft: 4 },
  divider: { height: 1, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayNumber: { width: 14, color: colors.muted, textAlign: 'center' },
  exercise: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
})
