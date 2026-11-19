import { StyleSheet } from 'react-native'
import { colors } from '../../theme'

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
export const WEEK = [1, 2, 3, 4, 5, 6, 7]
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const REMOVE_NOTE = 'Removing a day also removes any exercises logged on it.'

export const styles = StyleSheet.create({
  strong: { fontWeight: '600', color: colors.text },
  question: { fontSize: 16, fontWeight: '600', color: colors.text },
  stat: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.main },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statNumber: { fontSize: 28, fontWeight: '700', color: colors.text },
  statOf: { fontSize: 18, fontWeight: '500', color: colors.muted },
  week: { flexDirection: 'row', gap: 6 },
  weekCell: { flex: 1, paddingHorizontal: 0, alignItems: 'center' },
  tile: { minHeight: 56, justifyContent: 'center', gap: 2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  tileHalf: { flexGrow: 1, flexBasis: '45%' },
  tileSubtitle: { color: colors.muted, fontSize: 13 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', height: 42 }, // a seventh, rounded down so seven always fit a row
  weekday: { height: 24, textAlign: 'center', color: colors.muted, fontSize: 12 },
  day: { padding: 2, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  dayToday: { borderColor: colors.border },
  daySelected: { borderColor: colors.text },
  dayFill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  dayDone: { backgroundColor: colors.text },
  daySkipped: { backgroundColor: 'rgba(251, 191, 36, 0.8)' },
  dayTextLogged: { color: colors.main, fontWeight: '600' },
  dayTextFuture: { color: 'rgba(220, 224, 217, 0.3)' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  swatchPicked: { borderColor: colors.text },
  legendSwatch: { width: 12, height: 12, borderRadius: 3, marginLeft: 4 },
  divider: { height: 1, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayNumber: { width: 14, color: colors.muted, textAlign: 'center' },
  exercise: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
})
