import { Pressable, View } from 'react-native'
import { DAY_COLORS, type DayColor } from '@gainz/shared/dayColors'
import { computeWeeklyStreak, uniqueDays, weeklyGoal } from '@gainz/shared/splits'
import type { SplitLog, WorkoutSplit } from '@gainz/shared/types'
import { Check, Palette, Repeat, Target } from '../../icons'
import { QUEUED, useQueued, type UpdateSplitVars } from '../../queue'
import { colors } from '../../theme'
import { Text, Button, Card, Muted, styles as ui, useAnimatedState } from '../../ui'
import { styles } from './styles'
import { DaysPerWeek } from './parts'

export default function RoutineSummary({ split, allLogs, onChange }: { split: WorkoutSplit; allLogs: SplitLog[]; onChange: () => void }) {
  const updateSplit = useQueued<UpdateSplitVars>(QUEUED.updateSplit)
  const [editingGoal, setEditingGoal] = useAnimatedState(false)
  const [editingColors, setEditingColors] = useAnimatedState(false)
  const goal = weeklyGoal(split)
  const { streak, thisWeekDays } = computeWeeklyStreak(allLogs, goal)

  const changeGoal = (daysPerWeek: number) => {
    setEditingGoal(false)
    if (daysPerWeek !== goal) updateSplit.mutate({ label: `Weekly goal ${daysPerWeek}`, splitId: split.id, daysPerWeek })
  }

  // null = no colour for that day.
  const changeColor = (day: string, color: DayColor | null) => {
    const next = { ...split.dayColors } as Record<string, DayColor>
    if (color) next[day] = color
    else delete next[day]
    updateSplit.mutate({ label: `${day} colour`, splitId: split.id, dayColors: next })
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
      {editingColors ? (
        <View style={{ gap: 12 }}>
          <Muted>A colour for each day, shown on the calendar</Muted>
          {uniqueDays(split.days).map(({ label }) => (
            <View key={label} style={{ gap: 6 }}>
              <Text>{label}</Text>
              <View style={[ui.row, { flexWrap: 'wrap' }]}>
                {([null, ...Object.keys(DAY_COLORS)] as (DayColor | null)[]).map((key) => {
                  const picked = (split.dayColors?.[label] ?? null) === key
                  return (
                    <Pressable
                      key={key ?? 'none'}
                      onPress={() => changeColor(label, key)}
                      hitSlop={6}
                      accessibilityRole="radio"
                      accessibilityLabel={`${label}: ${key ?? 'no colour'}`}
                      accessibilityState={{ selected: picked }}
                      style={[styles.swatch, picked && styles.swatchPicked, { backgroundColor: key ? DAY_COLORS[key] : colors.text }]}
                    />
                  )
                })}
              </View>
            </View>
          ))}
          <Button label="Done" variant="small" onPress={() => setEditingColors(false)} />
        </View>
      ) : (
        <Button label="Day colours" icon={Palette} variant="small" onPress={() => setEditingColors(true)} />
      )}
    </Card>
  )
}
