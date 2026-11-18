import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
