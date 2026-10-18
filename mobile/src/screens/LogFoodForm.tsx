import { useState } from 'react'
import { Text, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { OTHER_MEAL } from '@gainz/shared/macros'
import { QUEUED, useQueued, type AddMealVars } from '../queue'
import { Button, Chip, Field, styles } from '../ui'

// Queued (see queue.ts): it shows up straight away and is sent now, or when the
// phone is back online. Problems are reported in the header, not here.
export default function LogFoodForm({
  mealNames,
  defaultMeal,
  onDone,
}: {
  mealNames: string[]
  defaultMeal: string
  onDone: () => void
}) {
  const [description, setDescription] = useState('')
  const [mealName, setMealName] = useState(defaultMeal)
  const [n, setN] = useState({ calories: '', proteinG: '', fatG: '', carbsG: '' })
  const add = useQueued<AddMealVars>(QUEUED.addMeal)
  const number = (value: string) => (value ? Number(value) : null)

  const save = () => {
    const meal = {
      id: randomUUID(),
      description: description.trim(),
      calories: Number(n.calories),
      proteinG: number(n.proteinG),
      fatG: number(n.fatG),
      carbsG: number(n.carbsG),
      mealName: mealName === OTHER_MEAL ? null : mealName,
      loggedAt: new Date().toISOString(),
    }
    add.mutate({ label: meal.description, meal })
    onDone()
  }

  const valid = description.trim() !== '' && n.calories !== '' && Number(n.calories) >= 0

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.cardTitle}>Log food</Text>
      <View style={styles.chips}>
        {[...mealNames, OTHER_MEAL].map((name) => (
          <Chip key={name} label={name} selected={mealName === name} onPress={() => setMealName(name)} />
        ))}
      </View>
      <Field label="Description" value={description} onChange={setDescription} placeholder="e.g. Chicken + rice" />
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Field label="Calories" value={n.calories} onChange={(v) => setN({ ...n, calories: v })} numeric />
        <Field label="Protein (g)" value={n.proteinG} onChange={(v) => setN({ ...n, proteinG: v })} numeric />
        <Field label="Fat (g)" value={n.fatG} onChange={(v) => setN({ ...n, fatG: v })} numeric />
        <Field label="Carbs (g)" value={n.carbsG} onChange={(v) => setN({ ...n, carbsG: v })} numeric />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button label="Add" onPress={save} disabled={!valid} />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
    </View>
  )
}
