import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { colorFor, dayColorKey, dayIcon, type DayColor, type DayIcon } from '@gainz/shared/dayColors'
import { SPLIT_TEMPLATES } from '@gainz/shared/templates'
import { ChevronDown, ChevronUp, Plus, X } from '../../icons'
import type { WorkoutSplit } from '@gainz/shared/types'
import { QUEUED, useQueued, type CreateSplitVars, type EditSplitVars } from '../../queue'
import { colors } from '../../theme'
import { Text, Button, Field, IconButton, Muted, styles as ui, animateLayout } from '../../ui'
import { styles } from './styles'
import { DaysPerWeek, Tile } from './parts'
import { DayStyleButton, DayStyleSheet } from './dayStyle'

// A day being written: its name, the colour and icon picked for it, and where it
// was in the routine being edited (null: a new day).
type DayDraft = { name: string; color: DayColor | null; icon: DayIcon | null; from: number | null }
const dayDraft = (name: string): DayDraft => ({ name, color: null, icon: null, from: null })

// Pick a template or build a custom routine (saving makes it the active one; the
// old one's days stay on the calendar and in the streak), or, with `editing`,
// change the current routine in place. A day with training logged
// (`loggedDays`, by position) can be renamed or moved but not removed.
export default function RoutineEditor({ editing, loggedDays, onDone }: { editing?: WorkoutSplit; loggedDays: Set<number>; onDone?: () => void }) {
  const createSplit = useQueued<CreateSplitVars>(QUEUED.createSplit)
  const editSplit = useQueued<EditSplitVars>(QUEUED.editSplit)
  const [draft, setDraft] = useState<{ name: string; days: DayDraft[] } | null>(() =>
    editing
      ? { name: editing.name, days: editing.days.map((name, i) => ({ name, color: dayColorKey(editing, name), icon: dayIcon(editing, name), from: i })) }
      : null,
  )
  const [styling, setStyling] = useState<number | null>(null) // the row whose picker is open
  // null until touched: then it follows the number of days (an edit starts from the routine's)
  const [perWeek, setPerWeek] = useState<number | null>(editing?.daysPerWeek ?? null)

  if (!draft) {
    return (
      <View style={{ gap: 8 }}>
        <Muted>{onDone ? 'Pick a new routine.' : 'Pick a routine to start tracking your weekly streak.'}</Muted>
        {SPLIT_TEMPLATES.map((template) => (
          <Tile
            key={template.name}
            title={template.name}
            subtitle={template.days.join(' → ')}
            onPress={() => animateLayout(() => setDraft({ name: template.name, days: template.days.map(dayDraft) }))}
          />
        ))}
        <Tile title="Custom" subtitle="Name your own days" onPress={() => animateLayout(() => setDraft({ name: '', days: [dayDraft(''), dayDraft('')] }))} />
        {onDone && <Button label="Cancel" variant="secondary" onPress={onDone} />}
      </View>
    )
  }

  const { name, days } = draft
  const cleaned = days.map((d) => ({ ...d, name: d.name.trim() })).filter((d) => d.name)
  const daysPerWeek = perWeek ?? Math.min(7, Math.max(1, cleaned.length))
  const setDays = (next: DayDraft[]) => setDraft({ name, days: next })
  const editDay = (index: number, changes: Partial<DayDraft>) => setDays(days.map((d, i) => (i === index ? { ...d, ...changes } : d)))
  // By day name, as saved: two rows with the same name share the last one's style.
  const styleMap = <K extends 'color' | 'icon'>(key: K) =>
    Object.fromEntries(cleaned.flatMap((d) => (d[key] ? [[d.name, d[key]]] : []))) as Record<string, NonNullable<DayDraft[K]>>
  const move = (index: number, by: number) => {
    const next = [...days]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    setDays(next)
  }

  const hasHistory = (day: DayDraft) => day.from != null && loggedDays.has(day.from)
  // A logged day left blank would be dropped on save, which the server refuses.
  const blankLogged = days.some((d) => hasHistory(d) && !d.name.trim())

  const save = () => {
    if (editing) {
      const body = {
        name: name.trim() || editing.name,
        days: cleaned.map((d) => ({ name: d.name, from: d.from })),
        daysPerWeek,
        dayColors: styleMap('color'),
        dayIcons: styleMap('icon'),
      }
      editSplit.mutate({ label: `Routine ${body.name}`, splitId: editing.id, body })
      onDone?.()
      return
    }
    const routine = {
      id: randomUUID(),
      name: name.trim() || 'My routine',
      days: cleaned.map((d) => d.name),
      daysPerWeek,
      dayColors: styleMap('color'),
      dayIcons: styleMap('icon'),
    }
    createSplit.mutate({ label: `Routine ${routine.name}`, split: routine })
    onDone?.()
  }

  return (
    <View style={{ gap: 16 }}>
      <Field label="Routine name" value={name} onChange={(v) => setDraft({ name: v, days })} />
      <View style={{ gap: 8 }}>
        <Muted>Days a week for a good week</Muted>
        <DaysPerWeek value={daysPerWeek} onChange={setPerWeek} />
      </View>
      <View style={{ gap: 8 }}>
        <Muted>Days, in order</Muted>
        {days.map((day, index) => (
          <View key={index} style={styles.dayRow}>
            <Text style={styles.dayNumber}>{index + 1}</Text>
            <DayStyleButton name={day.name} color={colorFor(day.color)} icon={day.icon} onPress={() => setStyling(index)} />
            <TextInput
              value={day.name}
              onChangeText={(v) => editDay(index, { name: v })}
              placeholder="e.g. Push"
              placeholderTextColor={colors.muted}
              accessibilityLabel={`Day ${index + 1}`}
              style={[ui.input, { flex: 1 }]}
            />
            <IconButton icon={ChevronUp} label={`Move day ${index + 1} up`} onPress={() => move(index, -1)} disabled={index === 0} />
            <IconButton icon={ChevronDown} label={`Move day ${index + 1} down`} onPress={() => move(index, 1)} disabled={index === days.length - 1} />
            <IconButton
              icon={X}
              label={hasHistory(day) ? `Day ${index + 1} has training logged: it can't be removed` : `Remove day ${index + 1}`}
              disabled={hasHistory(day)}
              onPress={() => animateLayout(() => setDays(days.filter((_, i) => i !== index)))}
            />
          </View>
        ))}
        <Button label="Add day" icon={Plus} variant="secondary" onPress={() => animateLayout(() => setDays([...days, dayDraft('')]))} />
        {days.some(hasHistory) && <Muted>Days with training logged can be renamed or moved, not removed. Their past days move with them.</Muted>}
      </View>
      <DayStyleSheet
        day={styling == null ? null : days[styling]?.name.trim() || `Day ${styling + 1}`}
        color={styling == null ? null : (days[styling]?.color ?? null)}
        icon={styling == null ? null : (days[styling]?.icon ?? null)}
        onChange={(color, icon) => styling != null && editDay(styling, { color, icon })}
        onClose={() => setStyling(null)}
      />
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button label="Save routine" onPress={save} disabled={cleaned.length === 0 || blankLogged} />
        </View>
        <Button label={editing ? 'Cancel' : 'Back'} variant="secondary" onPress={() => (editing ? onDone?.() : animateLayout(() => setDraft(null)))} />
      </View>
    </View>
  )
}
