import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { LucideIcon } from 'lucide-react-native'
import { X } from './icons'
import { colors, FONT } from './theme'

// React Native has no app-wide default font, so every screen uses this Text,
// which is the native one with Manrope first (a style can still override it).
export function Text({ style, ...props }: TextProps) {
  return <NativeText style={[{ fontFamily: FONT }, style]} {...props} />
}

// Small shared building blocks so every screen looks and behaves the same:
// 48px touch targets, the web palette, and labelled controls for TalkBack.

// No pull-to-refresh: it fired on ordinary scrolls, and data already refreshes
// on its own when a tab opens, the app comes back to the front (offline.ts) or
// the connection returns.
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  )
}

export function Card({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          {title && (
            <Text style={styles.cardTitle} accessibilityRole="header">
              {title}
            </Text>
          )}
          {right}
        </View>
      )}
      {children}
    </View>
  )
}

// A full-screen modal: what history lists open in. Android draws modals edge to
// edge too, so it clears the status and navigation bars itself.
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={styles.sheetHeader}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              {title}
            </Text>
            <IconButton icon={X} label="Close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  icon: Icon,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'small'
  disabled?: boolean
  accessibilityLabel?: string
  icon?: LucideIcon
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={variant === 'small' ? 8 : 0}
      style={({ pressed }) => [styles[variant], (pressed || disabled) && styles.dim]}
    >
      <View style={styles.buttonContent}>
        {Icon && <Icon size={16} color={variant === 'primary' ? colors.main : colors.text} />}
        <Text style={[variant === 'primary' ? styles.primaryText : styles.secondaryText, { flexShrink: 1 }]}>{label}</Text>
      </View>
    </Pressable>
  )
}

// `label` is what TalkBack reads, since there's no text to read.
export function IconButton({
  icon: Icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: LucideIcon
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.iconButton, (pressed || disabled) && styles.dim]}
    >
      <Icon size={18} color={colors.text} />
    </Pressable>
  )
}

export function Chip({
  label,
  selected,
  onPress,
  style,
  accessibilityLabel,
}: {
  label: string
  selected: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected, style]}
    >
      <Text style={selected ? styles.chipTextSelected : styles.text}>{label}</Text>
    </Pressable>
  )
}

// A labelled input. `numeric` brings up the decimal keypad and accepts a comma.
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  ...rest
}: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean } & Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'onChange'
>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(numeric ? text.replace(',', '.') : text)}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...rest}
      />
    </View>
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>
}

// On a row the server doesn't have yet (see useUnsyncedIds in queue.ts).
export function Unsynced() {
  return <Text style={styles.unsynced}>Not synced yet</Text>
}

export function ErrorText({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return (
    <Text style={styles.error} onPress={onPress} accessibilityRole={onPress ? 'button' : 'text'}>
      {children}
    </Text>
  )
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.main },
  screenContent: { padding: 16, paddingBottom: 32, gap: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  card: { gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flexShrink: 1, fontSize: 18, fontWeight: '600', color: colors.text },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.text },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  small: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  primaryText: { fontSize: 16, fontWeight: '600', color: colors.main },
  secondaryText: { fontWeight: '600', color: colors.text },
  dim: { opacity: 0.6 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipTextSelected: { color: colors.main, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  field: { gap: 4, flexGrow: 1, flexBasis: '45%' },
  label: { color: colors.muted, fontSize: 13 },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.main,
    color: colors.text,
    fontFamily: FONT,
  },
  text: { color: colors.text },
  muted: { color: colors.muted },
  error: { color: colors.danger },
  unsynced: { color: '#fcd34d', fontSize: 13 }, // the offline banner's amber
})
