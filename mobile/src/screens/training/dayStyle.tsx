import { Pressable, StyleSheet, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { colorFor, DAY_COLOR_KEYS, DAY_COLORS, DAY_ICON_KEYS, DAY_ICONS, type DayColor, type DayIcon } from '@gainz/shared/dayColors'
import { Activity, BicepsFlexed, Bike, Dumbbell, Flame, Footprints, HeartPulse, Mountain, Palette, PersonStanding, Target, Waves, X, Zap } from '../../icons'
import { colors } from '../../theme'
import { Text, Button, Muted, Sheet, styles as ui } from '../../ui'

export const DAY_ICON_COMPONENTS: Record<DayIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  biceps: BicepsFlexed,
  legs: Footprints,
  endurance: Activity,
  bike: Bike,
  cardio: HeartPulse,
  core: Target,
  stretch: PersonStanding,
  swim: Waves,
  hike: Mountain,
  flame: Flame,
  power: Zap,
}

// A routine day as a pill, filled with its colour and led by its icon. With
// onPress it opens the day's colour and icon picker.
export function DayPill({ name, color, icon, onPress }: { name: string; color: string | null; icon: DayIcon | null; onPress?: () => void }) {
  const Icon = icon ? DAY_ICON_COMPONENTS[icon] : null
  const fill = color ? { backgroundColor: color, borderColor: color } : null
  const content = (
    <>
      {Icon && <Icon size={14} color={color ? colors.main : colors.text} />}
      <Text style={[styles.pillText, color ? { color: colors.main } : null]}>{name}</Text>
    </>
  )
  if (!onPress) return <View style={[styles.pill, fill]}>{content}</View>
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}: change its colour and icon`}
      style={({ pressed }) => [styles.pill, fill, pressed && ui.dim]}
    >
      {content}
    </Pressable>
  )
}

// Beside a day's name in the routine editor: a round button showing the day's
// colour and icon (a palette while it has neither), opening the picker.
export function DayStyleButton({ name, color, icon, onPress }: { name: string; color: string | null; icon: DayIcon | null; onPress: () => void }) {
  const Icon = icon ? DAY_ICON_COMPONENTS[icon] : Palette
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name || 'Day'}: colour and icon`}
      style={({ pressed }) => [styles.styleButton, color ? { backgroundColor: color, borderColor: color } : null, pressed && ui.dim]}
    >
      <Icon size={18} color={color ? colors.main : icon ? colors.text : colors.muted} />
    </Pressable>
  )
}

// One day's colour (none + 7: two rows of four) and icon (12: three rows of
// four; tap the chosen one again to remove it). Each tap applies straight away.
export function DayStyleSheet({
  day,
  color,
  icon,
  onChange,
  onClose,
}: {
  day: string | null // null = closed
  color: DayColor | null
  icon: DayIcon | null
  onChange: (color: DayColor | null, icon: DayIcon | null) => void
  onClose: () => void
}) {
  return (
    <Sheet visible={day != null} title={day ?? ''} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <View style={{ alignItems: 'flex-start' }}>
          <DayPill name={day ?? ''} color={colorFor(color)} icon={icon} />
        </View>

        <Muted>Colour</Muted>
        <View style={styles.grid}>
          {([null, ...DAY_COLOR_KEYS] as (DayColor | null)[]).map((key) => {
            const picked = color === key
            return (
              <View key={key ?? 'none'} style={styles.cell}>
                <Pressable
                  onPress={() => onChange(key, icon)}
                  accessibilityRole="radio"
                  accessibilityLabel={key ?? 'No colour'}
                  accessibilityState={{ selected: picked }}
                  style={[styles.swatch, key ? { backgroundColor: DAY_COLORS[key] } : styles.swatchNone, picked && styles.picked]}
                >
                  {!key && <X size={18} color={colors.muted} />}
                </Pressable>
              </View>
            )
          })}
        </View>

        <Muted>Icon (tap the chosen one again to remove it)</Muted>
        <View style={styles.grid}>
          {DAY_ICON_KEYS.map((key) => {
            const Icon = DAY_ICON_COMPONENTS[key]
            const picked = icon === key
            return (
              <View key={key} style={styles.cell}>
                <Pressable
                  onPress={() => onChange(color, picked ? null : key)}
                  accessibilityRole="radio"
                  accessibilityLabel={DAY_ICONS[key]}
                  accessibilityState={{ selected: picked }}
                  style={[styles.iconBox, picked && styles.iconPicked]}
                >
                  <Icon size={22} color={picked ? colors.main : colors.text} />
                </Pressable>
                <Text style={styles.iconLabel} numberOfLines={1}>
                  {DAY_ICONS[key]}
                </Text>
              </View>
            )
          })}
        </View>

        <Button label="Done" onPress={onClose} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { fontWeight: '600' },
  styleButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  cell: { width: '25%', alignItems: 'center', gap: 4 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  swatchNone: { borderWidth: 1, borderColor: colors.border },
  picked: { borderWidth: 3, borderColor: colors.text },
  iconBox: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconPicked: { backgroundColor: colors.text, borderColor: colors.text },
  iconLabel: { fontSize: 12, color: colors.muted },
})
