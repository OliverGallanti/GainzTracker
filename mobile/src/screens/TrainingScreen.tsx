import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { startOfLocalDay } from '@gainz/shared/dates'
import { computeWeeklyStreak, suggestedDayIndex, uniqueDays, weeklyGoal } from '@gainz/shared/splits'
import { SPLIT_TEMPLATES } from '@gainz/shared/templates'
import type { SplitLog, WorkoutSplit } from '@gainz/shared/types'
import { api } from '../api'
import { QUEUED, useQueued, useUnsyncedIds, type LogDayVars, type RemoveVars } from '../queue'
import { colors } from '../theme'
import { Text, Button, Card, Chip, ErrorText, Muted, Screen, Unsynced, styles as ui } from '../ui'

const DAY_MS = 24 * 60 * 60 * 1000
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

export default function TrainingScreen() {
  const queryClient = useQueryClient()

  // Same load as the web card: the streak counts days across every routine, the
  // logger only uses the active one's logs.
  const training = useQuery({
    queryKey: ['training'],
    queryFn: async () => {
      const splits = await api<WorkoutSplit[]>('/api/workout-splits')
      const split = splits.find((s) => s.active) ?? null
      const logsBySplit = await Promise.all(splits.map((s) => api<SplitLog[]>(`/api/workout-splits/${s.id}/logs`)))
      return { split, logs: split ? logsBySplit[splits.indexOf(split)] : [], allLogs: logsBySplit.flat() }
    },
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['training'] })

  const split = training.data?.split
  const logs = training.data?.logs ?? []

  return (
    <Screen refreshing={training.isRefetching} onRefresh={() => void training.refetch()}>
      <Card title="Training">
        {training.isPending && <Muted>Loading…</Muted>}
        {training.isError && <ErrorText onPress={() => void training.refetch()}>Could not load your training: tap to retry</ErrorText>}
        {training.data && !split && <PickRoutine onCreated={refresh} />}
        {split && training.data && <TodayLogger split={split} logs={logs} allLogs={training.data.allLogs} />}
      </Card>

      {split && logs.length > 0 && <RecentLogs split={split} logs={logs} />}
    </Screen>
  )
}

function TodayLogger({
  split,
  logs,
  allLogs,
}: {
  split: WorkoutSplit
  logs: SplitLog[]
  allLogs: SplitLog[]
}) {
  const goal = weeklyGoal(split)
  const { streak, thisWeekDays } = computeWeeklyStreak(allLogs, goal)
  const todayLog = logs.find((log) => new Date(log.loggedAt).toDateString() === new Date().toDateString())
  const [picked, setPicked] = useState<number | null>(null)
  const selected = picked ?? split.days.indexOf(split.days[suggestedDayIndex(split.days, logs)])
  const logDay = useQueued<LogDayVars>(QUEUED.logDay)

  // Queued (see queue.ts). The day's bounds are fixed now, on the phone: sent
  // after midnight, it still counts for the day it was logged.
  const log = (completed: boolean) => {
    const dayStart = startOfLocalDay()
    logDay.mutate({
      label: `${split.days[selected]} (${completed ? 'done' : 'skipped'})`,
      splitId: split.id,
      log: { id: randomUUID(), dayIndex: selected, completed, loggedAt: new Date().toISOString() },
      dayStart: dayStart.toISOString(),
      dayEnd: new Date(dayStart.getTime() + DAY_MS).toISOString(),
    })
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

      {todayLog ? (
        <Muted>
          Today: {split.days[todayLog.dayIndex]} · {todayLog.completed ? 'done' : 'skipped'}. Remove it below to change it.
        </Muted>
      ) : (
        <>
          <Muted>What are you training today?</Muted>
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

function RecentLogs({ split, logs }: { split: WorkoutSplit; logs: SplitLog[] }) {
  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const unsynced = useUnsyncedIds()

  return (
    <Card title="Recent days">
      {logs.slice(0, 14).map((log) => (
        <View key={log.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={ui.text}>{split.days[log.dayIndex]}</Text>
            <Muted>
              {formatDate(log.loggedAt)} · {log.completed ? 'Done' : 'Skipped'}
              {log.durationMinutes ? ` · ${log.durationMinutes} min` : ''}
            </Muted>
            {unsynced.has(log.id) && <Unsynced />}
          </View>
          <Button
            label="Remove"
            variant="small"
            onPress={() =>
              remove.mutate({
                label: `Remove ${split.days[log.dayIndex]} on ${formatDate(log.loggedAt)}`,
                path: `/api/workout-splits/${split.id}/logs/${log.id}`,
                cacheKey: ['training'],
                id: log.id,
              })
            }
            accessibilityLabel={`Remove ${split.days[log.dayIndex]} on ${formatDate(log.loggedAt)}`}
          />
        </View>
      ))}
      <Muted>Removing a day also removes any exercises logged on it.</Muted>
    </Card>
  )
}

// No routine yet: start one from the same templates as the web app.
function PickRoutine({ onCreated }: { onCreated: () => void }) {
  const create = useMutation({
    mutationFn: (template: { name: string; days: string[] }) =>
      api('/api/workout-splits', {
        method: 'POST',
        body: JSON.stringify({ id: randomUUID(), name: template.name, days: template.days, daysPerWeek: Math.min(7, template.days.length) }),
      }),
    onSuccess: onCreated,
  })

  return (
    <View style={{ gap: 8 }}>
      <Muted>Pick a routine to start tracking your weekly streak. You can make a custom one on the web.</Muted>
      {SPLIT_TEMPLATES.map((template) => (
        <Button
          key={template.name}
          label={`${template.name} · ${template.days.join(' → ')}`}
          variant="secondary"
          onPress={() => create.mutate(template)}
          disabled={create.isPending}
        />
      ))}
      {create.isError && <ErrorText>Could not create that routine: please try again</ErrorText>}
    </View>
  )
}

const styles = StyleSheet.create({
  strong: { fontWeight: '600' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakNumber: { fontSize: 36, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
