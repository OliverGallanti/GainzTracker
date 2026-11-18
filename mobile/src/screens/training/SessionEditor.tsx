import { useState } from 'react'
import { View } from 'react-native'
import { describeTiming, setRow, setsBody, type SetRow } from '@gainz/shared/sessions'
import type { SplitLog, WorkoutSet } from '@gainz/shared/types'
import { Plus, X } from '../../icons'
import { QUEUED, useQueued, type ReplaceSetsVars, type UpdateLogVars } from '../../queue'
import { Button, Field, IconButton, Muted, styles as ui, animateLayout } from '../../ui'
import { formatDate, styles } from './styles'

// Form rows (SetRow): the inputs' text, plus what the form doesn't show, kept
// through a save. Saving replaces the day's sets with the rows in one queued
// write (one transaction on the server), so it can't stop halfway.
const emptyRow = (): SetRow => ({ exerciseName: '', weightKg: '', reps: '' })

export default function SessionEditor({ log, sets, onDone }: { log: SplitLog; sets: WorkoutSet[]; onDone: () => void }) {
  const replaceSets = useQueued<ReplaceSetsVars>(QUEUED.replaceSets)
  const updateLog = useQueued<UpdateLogVars>(QUEUED.updateLog)
  const [rows, setRows] = useState<SetRow[]>(() => (sets.length > 0 ? [...sets].reverse().map(setRow) : [emptyRow()]))
  const [duration, setDuration] = useState(log.durationMinutes ? String(log.durationMinutes) : '')

  const edit = (index: number, changes: Partial<SetRow>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...changes } : r)))

  const save = () => {
    replaceSets.mutate({ label: `Exercises on ${formatDate(log.loggedAt)}`, splitId: log.splitId, log, body: setsBody(rows) })
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
