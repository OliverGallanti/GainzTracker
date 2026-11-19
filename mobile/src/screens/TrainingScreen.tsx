import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { routineOf } from '@gainz/shared/splits'
import type { SplitLog, WorkoutSet, WorkoutSplit } from '@gainz/shared/types'
import { api } from '../api'
import type { TrainingData } from '../queue'
import { Card, ErrorText, Muted, Screen, Sheet, useAnimatedState } from '../ui'
import { formatDate, REMOVE_NOTE } from './training/styles'
import RoutineSummary from './training/RoutineSummary'
import Logger from './training/Logger'
import LogRow from './training/LogRow'
import LogEditor from './training/LogEditor'
import RoutineEditor from './training/RoutineEditor'

export default function TrainingScreen() {
  // Same load as the web card: every routine and every log. The calendar and
  // history show all of them (each log with its own routine's days), so
  // switching routines never makes the past look empty.
  const training = useQuery({
    queryKey: ['training'],
    queryFn: async (): Promise<TrainingData> => {
      const [splits, logs] = await Promise.all([api<WorkoutSplit[]>('/api/workout-splits'), api<SplitLog[]>('/api/workout-splits/logs')])
      return { split: splits.find((s) => s.active) ?? null, splits, logs }
    },
  })
  // Shared with Big 4 (same key): a session's exercises are the sets tagged with its log.
  const sets = useQuery({ queryKey: ['workoutSets'], queryFn: () => api<WorkoutSet[]>('/api/workout-sets') })
  // A new routine (starts over) or an edit of the current one.
  const [editingRoutine, setEditingRoutine] = useAnimatedState<'new' | 'edit' | null>(null)
  const [openLogId, setOpenLogId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const split = training.data?.split
  const splits = training.data?.splits ?? []
  const logs = training.data?.logs ?? []
  const openLog = logs.find((log) => log.id === openLogId)
  const openLogRoutine = openLog ? (routineOf(splits, openLog) ?? split) : null
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
        <Card title={!split ? 'Choose a routine' : editingRoutine === 'edit' ? 'Edit routine' : 'New routine'}>
          <RoutineEditor
            editing={editingRoutine === 'edit' && split ? split : undefined}
            loggedDays={new Set(logs.filter((l) => l.splitId === split?.id).map((l) => l.dayIndex))}
            onDone={split ? () => setEditingRoutine(null) : undefined}
          />
        </Card>
      )}

      {split && !editingRoutine && training.data && (
        <>
          <RoutineSummary split={split} logs={logs} onNew={() => setEditingRoutine('new')} onEdit={() => setEditingRoutine('edit')} />
          <Logger split={split} splits={splits} logs={logs} sets={sets.data} onOpenLog={setOpenLogId} onOpenHistory={() => setHistoryOpen(true)} />
        </>
      )}

      {split && (
        <Sheet visible={historyOpen || !!openLog} title={openLog ? formatDate(openLog.loggedAt) : 'Recent days'} onClose={closeSheet}>
          {openLog && openLogRoutine ? (
            <LogEditor key={openLog.id} split={openLogRoutine} log={openLog} sets={sets.data} onClose={closeSheet} />
          ) : (
            <>
              {logs.slice(0, 14).map((log) => (
                <LogRow key={log.id} split={routineOf(splits, log) ?? split} log={log} onEdit={() => setOpenLogId(log.id)} />
              ))}
              <Muted>{REMOVE_NOTE}</Muted>
            </>
          )}
        </Sheet>
      )}
    </Screen>
  )
}
