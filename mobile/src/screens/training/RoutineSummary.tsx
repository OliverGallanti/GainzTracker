import { useState } from 'react'
import { View } from 'react-native'
import { colorFor, dayColorKey, dayIcon, withDayStyle, type DayColor, type DayIcon } from '@gainz/shared/dayColors'
import { computeWeeklyStreak, uniqueDays, weeklyGoal } from '@gainz/shared/splits'
import type { SplitLog, WorkoutSplit } from '@gainz/shared/types'
import { Check, Pencil, Repeat, Target } from '../../icons'
import { QUEUED, useQueued, type UpdateSplitVars } from '../../queue'
import { colors } from '../../theme'
import { Text, Button, Card, Muted, styles as ui, useAnimatedState } from '../../ui'
import { styles } from './styles'
import { DaysPerWeek } from './parts'
import { DayPill, DayStyleSheet } from './dayStyle'

// The streak counts every routine's days (`logs`), so starting a new routine doesn't reset it.
export default function RoutineSummary({ split, logs, onNew, onEdit }: { split: WorkoutSplit; logs: SplitLog[]; onNew: () => void; onEdit: () => void }) {
  const updateSplit = useQueued<UpdateSplitVars>(QUEUED.updateSplit)
  const [editingGoal, setEditingGoal] = useAnimatedState(false)
  const [styling, setStyling] = useState<string | null>(null) // the day name whose picker is open
  const goal = weeklyGoal(split)
  const { streak, thisWeekDays } = computeWeeklyStreak(logs, goal)

  const changeGoal = (daysPerWeek: number) => {
    setEditingGoal(false)
    if (daysPerWeek !== goal) updateSplit.mutate({ label: `Weekly goal ${daysPerWeek}`, splitId: split.id, daysPerWeek })
  }

  const changeStyle = (day: string, color: DayColor | null, icon: DayIcon | null) =>
    updateSplit.mutate({ label: `${day} colour and icon`, splitId: split.id, ...withDayStyle(split, day, color, icon) })

  return (
    <Card title={split.name} right={<Button label="Edit routine" icon={Pencil} variant="small" onPress={onEdit} />}>
      <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
        {uniqueDays(split.days).map(({ label, index }) => (
          <DayPill key={index} name={label} color={colorFor(dayColorKey(split, label))} icon={dayIcon(split, label)} onPress={() => setStyling(label)} />
        ))}
      </View>
      <Muted>Tap a day to give it a colour and an icon.</Muted>
      <DayStyleSheet
        day={styling}
        color={styling ? dayColorKey(split, styling) : null}
        icon={styling ? dayIcon(split, styling) : null}
        onChange={(color, icon) => styling && changeStyle(styling, color, icon)}
        onClose={() => setStyling(null)}
      />
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
      <Button label="Start a new routine" icon={Repeat} variant="small" onPress={onNew} />
      <Muted>A new routine keeps your history: past days stay on the calendar and count toward the streak.</Muted>
    </Card>
  )
}
