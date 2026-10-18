import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsOnline } from './offline'
import { useSyncState } from './queue'
import BigFourScreen from './screens/BigFourScreen'
import ProfileScreen from './screens/ProfileScreen'
import TodayScreen from './screens/TodayScreen'
import TrainingScreen from './screens/TrainingScreen'
import WeightScreen from './screens/WeightScreen'
import { colors } from './theme'
import { Text, Button } from './ui'

const TABS = [
  { key: 'today', label: 'Today', Screen: TodayScreen },
  { key: 'weight', label: 'Weight', Screen: WeightScreen },
  { key: 'training', label: 'Training', Screen: TrainingScreen },
  { key: 'bigFour', label: 'Big 4', Screen: BigFourScreen },
  { key: 'profile', label: 'Profile', Screen: ProfileScreen },
] as const

// Five screens don't need a navigation library: a fixed header, the current
// screen, and a bottom bar. ponytail: no back-stack or deep links; add
// a navigator when a screen needs to push another.
export default function Tabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('today')
  const Current = TABS.find((t) => t.key === tab)!.Screen
  const online = useIsOnline()
  const sync = useSyncState()
  // Android draws the app under the status bar and the navigation bar (edge to
  // edge); these are their heights, so the header and tab bar clear them.
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.brand}>
          Gainz<Text style={styles.brandMuted}>.Tracker</Text>
        </Text>
      </View>

      {(!online || sync.waiting > 0) && (
        <View style={styles.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.offlineText}>
            {!online ? 'Offline: showing saved data. ' : ''}
            {sync.waiting > 0 ? `Waiting to sync (${sync.waiting}).` : 'What you log is sent when you reconnect.'}
          </Text>
        </View>
      )}

      {sync.failed.map((item) => (
        <View key={item.mutationId} style={styles.failed} accessibilityRole="alert">
          <Text style={styles.failedText}>Couldn't save: {item.variables.label}</Text>
          <Button label="Retry" variant="small" onPress={() => sync.retry(item)} />
          <Button label="Dismiss" variant="small" onPress={() => sync.dismiss(item.mutationId)} />
        </View>
      ))}

      <View style={styles.body}>
        <Current />
      </View>

      <View style={[styles.bar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            style={styles.tab}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextSelected]}>{t.label}</Text>
            <View style={[styles.indicator, tab === t.key && styles.indicatorSelected]} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.main },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: { fontSize: 20, fontWeight: '700', color: colors.text },
  brandMuted: { color: colors.muted },
  body: { flex: 1 },
  offline: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(251, 191, 36, 0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(251, 191, 36, 0.4)' },
  offlineText: { color: '#fcd34d', fontSize: 13 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: 'rgba(248, 113, 113, 0.12)' },
  failedText: { flex: 1, color: colors.danger, fontSize: 13 },
  bar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabText: { color: colors.muted, fontWeight: '500' },
  tabTextSelected: { color: colors.text, fontWeight: '700' },
  indicator: { width: 24, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  indicatorSelected: { backgroundColor: colors.text },
})
