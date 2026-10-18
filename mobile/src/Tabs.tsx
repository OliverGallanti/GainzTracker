import { useState } from 'react'
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { useAuth } from './auth'
import { useIsOnline } from './offline'
import TodayScreen from './screens/TodayScreen'
import TrainingScreen from './screens/TrainingScreen'
import WeightScreen from './screens/WeightScreen'
import { colors } from './theme'
import { Button } from './ui'

const TABS = [
  { key: 'today', label: 'Today', Screen: TodayScreen },
  { key: 'weight', label: 'Weight', Screen: WeightScreen },
  { key: 'training', label: 'Training', Screen: TrainingScreen },
] as const

// Three screens don't need a navigation library: a fixed header, the current
// screen, and a bottom bar. ponytail: no back-stack or deep links; add
// a navigator when a screen needs to push another.
export default function Tabs() {
  const { signOut } = useAuth()
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('today')
  const Current = TABS.find((t) => t.key === tab)!.Screen
  const online = useIsOnline()

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>
          Gainz<Text style={styles.brandMuted}>.Tracker</Text>
        </Text>
        <Button label="Sign out" variant="small" onPress={() => void signOut()} />
      </View>

      {!online && (
        <View style={styles.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.offlineText}>Offline: showing saved data. Logging needs a connection for now.</Text>
        </View>
      )}

      <View style={styles.body}>
        <Current />
      </View>

      <View style={styles.bar} accessibilityRole="tablist">
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
    paddingTop: (StatusBar.currentHeight ?? 24) + 8,
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
  bar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabText: { color: colors.muted, fontWeight: '500' },
  tabTextSelected: { color: colors.text, fontWeight: '700' },
  indicator: { width: 24, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  indicatorSelected: { backgroundColor: colors.text },
})
