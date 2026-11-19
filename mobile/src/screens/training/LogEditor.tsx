import { View } from 'react-native'
import { uniqueDays } from '@gainz/shared/splits'
import type { SplitLog, WorkoutSet, WorkoutSplit } from '@gainz/shared/types'
import { QUEUED, useQueued, type UpdateLogVars } from '../../queue'
import { Button, Chip, Muted, styles as ui } from '../../ui'
import { formatDate } from './styles'
import SessionEditor from './SessionEditor'

// A logged day opened up: change which day it was or whether it was done, and
// (when done) its exercises and duration.
export default function LogEditor({
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
    updateLog.mutate({ label: `${day} on ${formatDate(log.loggedAt)}: ${what}`, splitId: log.splitId, logId: log.id, changes })

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
