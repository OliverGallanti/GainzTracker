import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatSeconds } from '@gainz/shared/sessions'
import { CalendarDays, Dumbbell, Scale, Timer, User, Utensils } from './icons'
import { useIsOnline } from './offline'
import { useSyncState } from './queue'
import BigFourScreen from './screens/BigFourScreen'
import LiveWorkout from './screens/LiveWorkout'
import ProfileScreen from './screens/ProfileScreen'
import TodayScreen from './screens/TodayScreen'
import TrainingScreen from './screens/TrainingScreen'
import WeightScreen from './screens/WeightScreen'
import { colors } from './theme'
import { Text, Button } from './ui'
import { setWorkout, since, useNow, useWorkout } from './workout'

const TABS = [
  { key: 'today', label: 'Today', Page: TodayScreen, Icon: Utensils },
  { key: 'weight', label: 'Weight', Page: WeightScreen, Icon: Scale },
  { key: 'training', label: 'Training', Page: TrainingScreen, Icon: CalendarDays },
  { key: 'bigFour', label: 'Big 4', Page: BigFourScreen, Icon: Dumbbell },
  { key: 'profile', label: 'Profile', Page: ProfileScreen, Icon: User },
] as const

// Five screens don't need a navigation library: a fixed header, the screens side
// by side in a paging scroll view (swipe between them, or tap the bottom bar),
// and the bar. ponytail: no back-stack or deep links; add a navigator when a
// screen needs to push another.
export default function Tabs() {
  const [index, setIndex] = useState(0)
  const pager = useRef<ScrollViewInstance>(null)
  const { width } = useWindowDimensions()
  const online = useIsOnline()
  const sync = useSyncState()
  // Android draws the app under the status bar and the navigation bar (edge to
  // edge); these are their heights, so the header and tab bar clear them.
  const insets = useSafeAreaInsets()

  const go = (i: number) => {
    setIndex(i)
    pager.current?.scrollTo({ x: i * width, animated: true })
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports -- how React Native loads a bundled image
          source={require('../assets/GainzTrackerWordmark.svg')}
          // The file is a square with the wordmark centred; cover crops the empty top and bottom.
          contentFit="cover"
          style={styles.logo}
          accessibilityLabel="Gainz.Tracker"
        />
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

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(e) => setIndex(Math.min(TABS.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))))}
        style={styles.body}
      >
        {TABS.map(({ key, Page }) => (
          <View key={key} style={{ width }}>
            <Page />
          </View>
        ))}
      </ScrollView>

      <WorkoutBar onOpen={() => go(TABS.findIndex((t) => t.key === 'training'))} />
      <LiveWorkout />

      <View style={[styles.bar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
        {TABS.map((t, i) => (
          <Pressable
            key={t.key}
            onPress={() => go(i)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: index === i }}
            style={styles.tab}
          >
            <t.Icon size={20} color={index === i ? colors.text : colors.muted} />
            <Text style={[styles.tabText, index === i && styles.tabTextSelected]}>{t.label}</Text>
            <View style={[styles.indicator, index === i && styles.indicatorSelected]} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

// A minimised workout, on every tab: tap to go back to it.
function WorkoutBar({ onOpen }: { onOpen: () => void }) {
  const workout = useWorkout()
  if (!workout || workout.open) return null
  return (
    <WorkoutBarClock
      startedAt={workout.startedAt}
      day={workout.day}
      onPress={() => {
        onOpen()
        setWorkout({ ...workout, open: true })
      }}
    />
  )
}

// Its own component, so the clock only ticks while the bar is showing.
function WorkoutBarClock({ startedAt, day, onPress }: { startedAt: number; day: string; onPress: () => void }) {
  const now = useNow()
  const time = formatSeconds(since(startedAt, now))
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${day} workout in progress, ${time}. Open`} style={styles.workoutBar}>
      <Timer size={18} color={colors.main} />
      <Text style={styles.workoutBarText}>{day} in progress</Text>
      <Text style={[styles.workoutBarText, { fontVariant: ['tabular-nums'] }]}>{time}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.main },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: { height: 40, aspectRatio: 2.75, marginLeft: -6 }, // the wordmark starts ~6% in from the file's edge
  body: { flex: 1 },
  offline: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(251, 191, 36, 0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(251, 191, 36, 0.4)' },
  offlineText: { color: '#fcd34d', fontSize: 13 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: 'rgba(248, 113, 113, 0.12)' },
  failedText: { flex: 1, color: colors.danger, fontSize: 13 },
  bar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 6 },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  tabTextSelected: { color: colors.text, fontWeight: '700' },
  indicator: { width: 24, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  indicatorSelected: { backgroundColor: colors.text },
  workoutBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 44, backgroundColor: colors.text },
  workoutBarText: { color: colors.main, fontWeight: '700' },
})
