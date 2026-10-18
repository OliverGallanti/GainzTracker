import type { ReactNode } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native'
import { colors, FONT } from './theme'

// React Native has no app-wide default font, so every screen uses this Text,
// which is the native one with Manrope first (a style can still override it).
export function Text({ style, ...props }: TextProps) {
  return <NativeText style={[{ fontFamily: FONT }, style]} {...props} />
}

// Small shared building blocks so every screen looks and behaves the same:
// 48px touch targets, the web palette, and labelled controls for TalkBack.

export function Screen({
  children,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} /> : undefined
      }
    >
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

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'small'
  disabled?: boolean
  accessibilityLabel?: string
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
      <Text style={variant === 'primary' ? styles.primaryText : styles.secondaryText}>{label}</Text>
    </Pressable>
  )
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
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
  card: { gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
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
