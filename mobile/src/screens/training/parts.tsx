import { Pressable, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { colors } from '../../theme'
import { Text, Chip, styles as ui } from '../../ui'
import { WEEK, styles } from './styles'

// Seven equal cells, so the row always fits on one line.
export function DaysPerWeek({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <View style={styles.week}>
      {WEEK.map((n) => (
        <Chip
          key={n}
          label={String(n)}
          selected={value === n}
          onPress={() => onChange(n)}
          style={styles.weekCell}
          accessibilityLabel={`${n} ${n === 1 ? 'day' : 'days'} a week`}
        />
      ))}
    </View>
  )
}
// A big tappable choice: a routine day (with its icon, and its colour as a
// stripe on the left), or a template.
export function Tile({
  title,
  subtitle,
  selected = false,
  half = false,
  icon: Icon,
  color,
  onPress,
}: {
  title: string
  subtitle?: string
  selected?: boolean
  half?: boolean
  icon?: LucideIcon | null
  color?: string | null
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.tile, half && styles.tileHalf, color ? { borderLeftWidth: 6, borderLeftColor: color } : null, selected && ui.chipSelected]}
    >
      <View style={[ui.row, { gap: 8 }]}>
        {Icon && <Icon size={16} color={selected ? colors.main : colors.text} />}
        <Text style={selected ? ui.chipTextSelected : styles.strong}>{title}</Text>
      </View>
      {subtitle && <Text style={[styles.tileSubtitle, selected && { color: colors.main }]}>{subtitle}</Text>}
    </Pressable>
  )
}
