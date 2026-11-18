import { View } from 'react-native'
import { computeWeeklyStreak, weeklyGoal } from '@gainz/shared/splits'
import type { SplitLog, WorkoutSplit } from '@gainz/shared/types'
import { Check, Repeat, Target } from '../../icons'
import { QUEUED, useQueued, type UpdateSplitVars } from '../../queue'
import { colors } from '../../theme'
import { Text, Button, Card, Muted, styles as ui, useAnimatedState } from '../../ui'
import { styles } from './styles'
import { DaysPerWeek } from './parts'

export default function RoutineSummary({ split, allLogs, onChange }: { split: WorkoutSplit; allLogs: SplitLog[]; onChange: () => void }) {
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
