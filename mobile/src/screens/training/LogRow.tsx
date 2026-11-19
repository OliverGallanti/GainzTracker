import { View } from 'react-native'
import { dayColor, dayIcon } from '@gainz/shared/dayColors'
import type { SplitLog, WorkoutSplit } from '@gainz/shared/types'
import { QUEUED, useQueued, useUnsyncedIds, type RemoveVars } from '../../queue'
import { Button, Muted, Unsynced } from '../../ui'
import { formatDate, styles } from './styles'
import { DayPill } from './dayStyle'

export default function LogRow({ split, log, onEdit }: { split: WorkoutSplit; log: SplitLog; onEdit: () => void }) {
  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const unsynced = useUnsyncedIds()
  const name = `${split.days[log.dayIndex]} on ${formatDate(log.loggedAt)}`

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-start' }}>
          <DayPill name={split.days[log.dayIndex]} color={dayColor(split, log.dayIndex)} icon={dayIcon(split, split.days[log.dayIndex])} />
        </View>
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
