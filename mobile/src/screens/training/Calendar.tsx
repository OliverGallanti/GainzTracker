import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { buildMonthGrid, startOfLocalDay } from '@gainz/shared/dates'
import type { SplitLog } from '@gainz/shared/types'
import { ChevronLeft, ChevronRight } from '../../icons'
import { Text, IconButton, styles as ui } from '../../ui'
import { formatDate, WEEKDAY_LABELS, styles } from './styles'

// The month, as on the web: done and skipped days filled in, any past day can be
// picked, future ones can't. Tapping today or the picked day goes back to today.
export default function Calendar({ logs, selected, onSelect }: { logs: SplitLog[]; selected: Date; onSelect: (date: Date | null) => void }) {
  const today = startOfLocalDay()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const logsByDate = new Map(logs.map((log) => [new Date(log.loggedAt).toDateString(), log]))
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const turn = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1))

  return (
    <View>
      <View style={styles.monthHeader}>
        <IconButton icon={ChevronLeft} label="Previous month" onPress={() => turn(-1)} />
        <Text style={styles.strong} accessibilityRole="header">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <IconButton icon={ChevronRight} label="Next month" onPress={() => turn(1)} disabled={isCurrentMonth} />
      </View>
      <View style={styles.grid}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={[styles.cell, styles.weekday]}>
            {label}
          </Text>
        ))}
        {buildMonthGrid(month).map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />
          const key = date.toDateString()
          const log = logsByDate.get(key)
          const isToday = key === today.toDateString()
          const isSelected = key === selected.toDateString()
          const future = date > today
          return (
            <Pressable
              key={i}
              onPress={() => onSelect(isToday || isSelected ? null : date)}
              disabled={future}
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(date.toISOString())}${log ? (log.completed ? ', done' : ', skipped') : ''}`}
              accessibilityState={{ selected: isSelected, disabled: future }}
              style={[styles.cell, styles.day, isToday && styles.dayToday, isSelected && styles.daySelected]}
            >
              <View style={[styles.dayFill, log && (log.completed ? styles.dayDone : styles.daySkipped)]}>
                <Text style={log ? styles.dayTextLogged : future ? styles.dayTextFuture : ui.muted}>{date.getDate()}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
