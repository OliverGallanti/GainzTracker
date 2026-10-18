import { useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ADULT_AGE, PROTEIN_RANGE_TEXT, suggestMacros, tdeePresets, type Goal } from '@gainz/shared/macroSplit'
import { computeBmr, computeTdee } from '@gainz/shared/tdee'
import type { MacroGoal, Me } from '@gainz/shared/types'
import { api } from '../api'
import { Text, Button, Chip, ErrorText, Field, Muted, styles } from '../ui'

const text = (value: number | null | undefined) => (value == null ? '' : String(value))

// The web targets form, same rules: calorie presets from the TDEE estimate
// (floored, maintenance-only for under-18s), then a suggested split that only
// fills the fields. Nothing is saved until Save.
export default function TargetsForm({
  goal,
  me,
  bodyweight,
  onDone,
}: {
  goal: MacroGoal | null
  me: Me
  bodyweight: number | null
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    calorieTarget: text(goal?.calorieTarget),
    proteinG: text(goal?.proteinG),
    fatG: text(goal?.fatG),
    carbsG: text(goal?.carbsG),
  })
  const [preset, setPreset] = useState<Goal>('maintain')

  const tdee = computeTdee(computeBmr(bodyweight, me.heightCm, me.age, me.sex), me.activityLevel)
  const presets = tdee == null ? [] : tdeePresets(tdee, me.sex, me.age)
  const isMinor = me.age != null && me.age < ADULT_AGE
  const calories = Number(form.calorieTarget)
  const canSuggest = !isMinor && bodyweight != null && calories > 0

  const suggest = () => {
    const split = suggestMacros({ calories, weightKg: bodyweight, goal: preset })
    if (split) setForm({ ...form, proteinG: String(split.proteinG), fatG: String(split.fatG), carbsG: String(split.carbsG) })
  }

  const save = useMutation({
    mutationFn: () =>
      api('/api/macro-goal', {
        method: 'PUT',
        body: JSON.stringify({
          proteinG: Number(form.proteinG),
          fatG: Number(form.fatG),
          carbsG: Number(form.carbsG),
          ...(form.calorieTarget ? { calorieTarget: Number(form.calorieTarget) } : {}),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today'] })
      onDone()
    },
  })

  const valid = [form.proteinG, form.fatG, form.carbsG].every((v) => Number(v) > 0)

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.cardTitle}>Daily targets</Text>

      {tdee == null ? (
        <Muted>Fill in your sex, age and activity level in the Profile tab, and log a weight and height, to get a calorie estimate.</Muted>
      ) : (
        <>
          <Muted>Estimated maintenance: {tdee} cal/day</Muted>
          <View style={styles.chips}>
            {presets.map((p) => (
              <Chip
                key={p.key}
                label={p.available ? `${p.label} · ${p.calories}` : `${p.label} · not advised`}
                selected={preset === p.key && form.calorieTarget === String(p.calories)}
                onPress={() => {
                  if (!p.available) return
                  setPreset(p.key)
                  setForm({ ...form, calorieTarget: String(p.calories) })
                }}
              />
            ))}
          </View>
        </>
      )}

      <Field label="Calories" value={form.calorieTarget} onChange={(v) => setForm({ ...form, calorieTarget: v })} numeric />

      <Muted>
        1 g protein = 4 cal, 1 g carbs = 4 cal, 1 g fat = 9 cal. A common protein range for people who lift is{' '}
        {PROTEIN_RANGE_TEXT}.
      </Muted>
      <Button label="Suggest protein, fat and carbs" variant="secondary" onPress={suggest} disabled={!canSuggest} />
      {isMinor && <Muted>Suggestions are for adults. If you are under 18, ask a doctor or dietitian.</Muted>}

      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Field label="Protein (g)" value={form.proteinG} onChange={(v) => setForm({ ...form, proteinG: v })} numeric />
        <Field label="Fat (g)" value={form.fatG} onChange={(v) => setForm({ ...form, fatG: v })} numeric />
        <Field label="Carbs (g)" value={form.carbsG} onChange={(v) => setForm({ ...form, carbsG: v })} numeric />
      </View>

      <Muted>General guidance for healthy adults, not medical advice.</Muted>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button label={save.isPending ? 'Saving…' : 'Save'} onPress={() => save.mutate()} disabled={!valid || save.isPending} />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
      {save.isError && <ErrorText>Could not save your targets: please try again</ErrorText>}
    </View>
  )
}
