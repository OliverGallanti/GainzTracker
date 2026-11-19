import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { buildMonthGrid, startOfLocalDay } from '@gainz/shared/dates'
import { ChevronLeft, ChevronRight } from '../../icons'
import { Text, IconButton, styles as ui } from '../../ui'
import { formatDate, WEEKDAY_LABELS, styles } from './styles'

// note: what TalkBack adds, e.g. 'done'; color: a filled day's own colour (a routine day's)
export type DayMark = { filled: boolean; note: string; color?: string | null }

// The month, as on the web: marked days filled in (amber when not `filled`), any
// past day can be picked, future ones can't. Tapping today or the picked day
// goes back to today. `onMonth` says which month is shown, to load its marks.
export default function Calendar({
  mark,
  selected,
  onSelect,
  onMonth,
}: {
  mark: (date: Date) => DayMark | undefined
  selected: Date
  onSelect: (date: Date | null) => void
  onMonth?: (month: Date) => void
}) {
  const today = startOfLocalDay()
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const turn = (by: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + by, 1)
    setMonth(next)
    onMonth?.(next)
  }

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
          const log = mark(date)
          const isToday = key === today.toDateString()
          const isSelected = key === selected.toDateString()
          const future = date > today
          return (
            <Pressable
              key={i}
              onPress={() => onSelect(isToday || isSelected ? null : date)}
              disabled={future}
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(date.toISOString())}${log ? `, ${log.note}` : ''}`}
              accessibilityState={{ selected: isSelected, disabled: future }}
              style={[styles.cell, styles.day, isToday && styles.dayToday, isSelected && styles.daySelected]}
            >
              <View style={[styles.dayFill, log && (log.filled ? styles.dayDone : styles.daySkipped), log?.filled && log.color ? { backgroundColor: log.color } : null]}>
                <Text style={log ? styles.dayTextLogged : future ? styles.dayTextFuture : ui.muted}>{date.getDate()}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
