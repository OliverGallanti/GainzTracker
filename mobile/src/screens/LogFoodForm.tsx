import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { OTHER_MEAL } from '@gainz/shared/macros'
import { api } from '../api'
import { colors } from '../theme'

const FIELDS = [
  { key: 'calories', label: 'Calories' },
  { key: 'proteinG', label: 'Protein (g)' },
  { key: 'fatG', label: 'Fat (g)' },
  { key: 'carbsG', label: 'Carbs (g)' },
] as const

type Numbers = Record<(typeof FIELDS)[number]['key'], string>

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
  const [numbers, setNumbers] = useState<Numbers>({ calories: '', proteinG: '', fatG: '', carbsG: '' })
  const [id] = useState(() => randomUUID()) // one id per form, so a re-press retries the same create

  const save = useMutation({
    mutationFn: () =>
      api('/api/meals', {
        method: 'POST',
        body: JSON.stringify({
          id,
          description: description.trim(),
          calories: Number(numbers.calories),
          ...(numbers.proteinG ? { proteinG: Number(numbers.proteinG) } : {}),
          ...(numbers.fatG ? { fatG: Number(numbers.fatG) } : {}),
          ...(numbers.carbsG ? { carbsG: Number(numbers.carbsG) } : {}),
          ...(mealName !== OTHER_MEAL ? { mealName } : {}),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today'] })
      onDone()
    },
  })

  const valid = description.trim() !== '' && numbers.calories !== '' && Number(numbers.calories) >= 0

  return (
    <View style={styles.form}>
      <Text style={styles.heading}>Log food</Text>

      <View style={styles.chips}>
        {[...mealNames, OTHER_MEAL].map((name) => (
          <Pressable
            key={name}
            onPress={() => setMealName(name)}
            accessibilityRole="button"
            accessibilityState={{ selected: mealName === name }}
            style={[styles.chip, mealName === name && styles.chipSelected]}
          >
            <Text style={mealName === name ? styles.chipTextSelected : styles.chipText}>{name}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description (e.g. Chicken + rice)"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Description"
        style={styles.input}
      />
      <View style={styles.grid}>
        {FIELDS.map((field) => (
          <TextInput
            key={field.key}
            value={numbers[field.key]}
            onChangeText={(value) => setNumbers({ ...numbers, [field.key]: value.replace(',', '.') })}
            placeholder={field.label}
            placeholderTextColor={colors.muted}
            accessibilityLabel={field.label}
            keyboardType="decimal-pad"
            style={[styles.input, styles.gridInput]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => save.mutate()}
          disabled={!valid || save.isPending}
          accessibilityRole="button"
          style={[styles.primary, (!valid || save.isPending) && styles.disabled]}
        >
          <Text style={styles.primaryText}>{save.isPending ? 'Saving…' : 'Add'}</Text>
        </Pressable>
        <Pressable onPress={onDone} accessibilityRole="button" style={styles.secondary}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
      </View>

      {save.isError && <Text style={styles.error}>Could not log that food: please try again</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  heading: { fontSize: 16, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text },
  chipTextSelected: { color: colors.main, fontWeight: '600' },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.main,
    color: colors.text,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridInput: { flexBasis: '47%', flexGrow: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  primary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.text },
  primaryText: { fontWeight: '600', color: colors.main },
  secondary: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  secondaryText: { fontWeight: '600', color: colors.text },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger },
})
