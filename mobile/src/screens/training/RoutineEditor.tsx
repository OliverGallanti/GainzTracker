import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { SPLIT_TEMPLATES } from '@gainz/shared/templates'
import { ChevronDown, ChevronUp, Plus, X } from '../../icons'
import { QUEUED, useQueued, type CreateSplitVars } from '../../queue'
import { colors } from '../../theme'
import { Text, Button, Field, IconButton, Muted, styles as ui, animateLayout } from '../../ui'
import { styles } from './styles'
import { DaysPerWeek, Tile } from './parts'

// Pick a template or build a custom routine. Saving makes it the active routine;
// the old one's days still count toward the streak.
export default function RoutineEditor({ onDone }: { onDone?: () => void }) {
  const createSplit = useQueued<CreateSplitVars>(QUEUED.createSplit)
  const [draft, setDraft] = useState<{ name: string; days: string[] } | null>(null)
  const [perWeek, setPerWeek] = useState<number | null>(null) // null until touched: then it follows the number of days

  if (!draft) {
    return (
      <View style={{ gap: 8 }}>
        <Muted>{onDone ? 'Pick a new routine.' : 'Pick a routine to start tracking your weekly streak.'}</Muted>
        {SPLIT_TEMPLATES.map((template) => (
          <Tile
            key={template.name}
            title={template.name}
            subtitle={template.days.join(' → ')}
            onPress={() => animateLayout(() => setDraft({ name: template.name, days: [...template.days] }))}
          />
        ))}
        <Tile title="Custom" subtitle="Name your own days" onPress={() => animateLayout(() => setDraft({ name: '', days: ['', ''] }))} />
        {onDone && <Button label="Cancel" variant="secondary" onPress={onDone} />}
      </View>
    )
  }

  const { name, days } = draft
  const cleaned = days.map((d) => d.trim()).filter(Boolean)
  const daysPerWeek = perWeek ?? Math.min(7, Math.max(1, cleaned.length))
  const setDays = (next: string[]) => setDraft({ name, days: next })
  const move = (index: number, by: number) => {
    const next = [...days]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    setDays(next)
  }

  const save = () => {
    const routine = { id: randomUUID(), name: name.trim() || 'My routine', days: cleaned, daysPerWeek }
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
            <TextInput
              value={day}
              onChangeText={(v) => setDays(days.map((d, i) => (i === index ? v : d)))}
              placeholder="e.g. Push"
              placeholderTextColor={colors.muted}
              accessibilityLabel={`Day ${index + 1}`}
              style={[ui.input, { flex: 1 }]}
            />
            <IconButton icon={ChevronUp} label={`Move day ${index + 1} up`} onPress={() => move(index, -1)} disabled={index === 0} />
            <IconButton icon={ChevronDown} label={`Move day ${index + 1} down`} onPress={() => move(index, 1)} disabled={index === days.length - 1} />
            <IconButton icon={X} label={`Remove day ${index + 1}`} onPress={() => animateLayout(() => setDays(days.filter((_, i) => i !== index)))} />
          </View>
        ))}
        <Button label="Add day" icon={Plus} variant="secondary" onPress={() => animateLayout(() => setDays([...days, '']))} />
      </View>
      <View style={ui.row}>
        <View style={{ flex: 1 }}>
          <Button label="Save routine" onPress={save} disabled={cleaned.length === 0} />
        </View>
        <Button label="Back" variant="secondary" onPress={() => animateLayout(() => setDraft(null))} />
      </View>
    </View>
  )
}
