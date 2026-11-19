import { useState } from 'react'
import { View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { startOfLocalDay } from '@gainz/shared/dates'
import { dayColor, dayIcon } from '@gainz/shared/dayColors'
import { logOnDay, suggestedDayIndex, uniqueDays } from '@gainz/shared/splits'
import type { SplitLog, WorkoutSet, WorkoutSplit } from '@gainz/shared/types'
import { Check, History, Timer } from '../../icons'
import { QUEUED, useQueued, type LogDayVars } from '../../queue'
import { Text, Button, Card, Muted, styles as ui, useAnimatedState } from '../../ui'
import { setWorkout, startWorkout, useWorkout } from '../../workout'
import { formatDate, REMOVE_NOTE, styles } from './styles'
import { Tile } from './parts'
import { DAY_ICON_COMPONENTS } from './dayStyle'
import Calendar from './Calendar'
import LogRow from './LogRow'

export default function Logger({
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
  const targetLog = logOnDay(logs, target)

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
      <Calendar
        mark={(date) => {
          const day = logOnDay(logs, date)
          return day && { filled: day.completed, note: day.completed ? `${split.days[day.dayIndex]} done` : 'skipped', color: dayColor(split, day.dayIndex) }
        }}
        selected={target}
        onSelect={setPickedDate}
      />
      <View style={styles.legend}>
        <View style={[styles.legendSwatch, styles.dayDone]} />
        <Muted>Done</Muted>
        {uniqueDays(split.days).map(({ label, index }) =>
          dayColor(split, index) ? (
            <View key={index} style={styles.legend}>
              <View style={[styles.legendSwatch, { backgroundColor: dayColor(split, index)! }]} />
              <Muted>{label}</Muted>
            </View>
          ) : null,
        )}
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
                icon={dayIcon(split, label) && DAY_ICON_COMPONENTS[dayIcon(split, label)!]}
                color={dayColor(split, index)}
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
