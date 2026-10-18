import { useState } from 'react'
import { Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { OTHER_MEAL } from '@gainz/shared/macros'
import { api } from '../api'
import { Button, Chip, ErrorText, Field, styles } from '../ui'

// Sends a phone-made id with the create, so a retry after a dropped connection
// can't log the food twice (the server returns the first one instead).
export default function LogFoodForm({
  mealNames,
  defaultMeal,
  onDone,
}: {
  mealNames: string[]
  defaultMeal: string
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState('')
  const [mealName, setMealName] = useState(defaultMeal)
  const [n, setN] = useState({ calories: '', proteinG: '', fatG: '', carbsG: '' })
  const [id] = useState(() => randomUUID()) // one id per form, so a re-press retries the same create

  const save = useMutation({
    mutationFn: () =>
      api('/api/meals', {
        method: 'POST',
        body: JSON.stringify({
          id,
          description: description.trim(),
          calories: Number(n.calories),
          ...(n.proteinG ? { proteinG: Number(n.proteinG) } : {}),
          ...(n.fatG ? { fatG: Number(n.fatG) } : {}),
          ...(n.carbsG ? { carbsG: Number(n.carbsG) } : {}),
          ...(mealName !== OTHER_MEAL ? { mealName } : {}),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today'] })
      onDone()
    },
  })

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
          <Button label={save.isPending ? 'Saving…' : 'Add'} onPress={() => save.mutate()} disabled={!valid || save.isPending} />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
      {save.isError && <ErrorText>Could not log that food: please try again</ErrorText>}
    </View>
  )
}
