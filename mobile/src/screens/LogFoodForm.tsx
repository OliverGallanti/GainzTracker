import { useState } from 'react'
import { Linking, Pressable, Switch, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { OTHER_MEAL, scaleFood } from '@gainz/shared/macros'
import type { Product, SavedFood } from '@gainz/shared/types'
import { useSavedFoods } from '../queries'
import { QUEUED, useQueued, type AddMealVars, type SaveFoodVars } from '../queue'
import { colors } from '../theme'
import { Text, Button, Chip, Field, Muted, styles } from '../ui'
import ProductLookup from './ProductLookup'

const text = (value: number | null) => (value == null ? '' : String(value))
const number = (value: string) => (value ? Number(value) : null)

// Queued (see queue.ts): it shows up straight away and is sent now, or when the
// phone is back online. Problems are reported in the header, not here.
// A saved food fills the form (times the servings), still editable; "Save for
// reuse" stores the entered macros as one serving, as on the web. A scanned
// product works the same way, scaled by the grams eaten instead (its values are per 100 g).
export default function LogFoodForm({
  mealNames,
  defaultMeal,
  onDone,
}: {
  mealNames: string[]
  defaultMeal: string
  onDone: () => void
}) {
  const savedFoods = useSavedFoods()
  const [description, setDescription] = useState('')
  const [mealName, setMealName] = useState(defaultMeal)
  const [n, setN] = useState({ calories: '', proteinG: '', fatG: '', carbsG: '' })
  const [picked, setPicked] = useState<SavedFood | null>(null)
  const [servings, setServings] = useState('1')
  const [product, setProduct] = useState<Product | null>(null)
  const [grams, setGrams] = useState('')
  const [saveForReuse, setSaveForReuse] = useState(false)
  const add = useQueued<AddMealVars>(QUEUED.addMeal)
  const saveFood = useQueued<SaveFoodVars>(QUEUED.saveFood)

  const fillFrom = (name: string, food: Parameters<typeof scaleFood>[0], count: number) => {
    const scaled = scaleFood(food, count)
    setDescription(name)
    setN({ calories: text(scaled.calories), proteinG: text(scaled.proteinG), fatG: text(scaled.fatG), carbsG: text(scaled.carbsG) })
  }

  const pick = (food: SavedFood) => {
    setPicked(food)
    setProduct(null)
    setServings('1')
    setSaveForReuse(false)
    fillFrom(food.name, food, 1)
  }

  const changeServings = (value: string) => {
    setServings(value)
    if (picked && Number(value) > 0) fillFrom(picked.name, picked, Number(value))
  }

  // Start from the label's serving size when it has one, otherwise 100 g.
  const pickProduct = (found: Product) => {
    const start = found.servingG ?? 100
    setProduct(found)
    setPicked(null)
    setGrams(String(start))
    fillFrom(found.name, found.per100g, start / 100)
  }

  const changeGrams = (value: string) => {
    setGrams(value)
    if (product && Number(value) > 0) fillFrom(product.name, product.per100g, Number(value) / 100)
  }

  const save = () => {
    const macros = { calories: Math.round(Number(n.calories)), proteinG: number(n.proteinG), fatG: number(n.fatG), carbsG: number(n.carbsG) }
    if (saveForReuse && !picked) {
      saveFood.mutate({ label: `Save ${description.trim()}`, food: { name: description.trim(), ...macros } })
    }
    add.mutate({
      label: description.trim(),
      meal: {
        id: randomUUID(),
        description: description.trim(),
        ...macros,
        mealName: mealName === OTHER_MEAL ? null : mealName,
        loggedAt: new Date().toISOString(),
      },
    })
    onDone()
  }

  const valid = description.trim() !== '' && n.calories !== '' && Number(n.calories) >= 0
  const foods = savedFoods.data ?? []

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.cardTitle}>Log food</Text>

      {foods.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Saved foods</Text>
          <View style={styles.chips}>
            {foods.map((food) => (
              <Chip key={food.id} label={food.name} selected={picked?.id === food.id} onPress={() => pick(food)} />
            ))}
          </View>
        </View>
      )}

      <ProductLookup onFound={pickProduct} />

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Meal</Text>
        <View style={styles.chips}>
          {[...mealNames, OTHER_MEAL].map((name) => (
            <Chip key={name} label={name} selected={mealName === name} onPress={() => setMealName(name)} />
          ))}
        </View>
      </View>

      <Field label="Description" value={description} onChange={setDescription} placeholder="e.g. Chicken + rice" />
      {picked && <Field label={`Servings of ${picked.name}`} value={servings} onChange={changeServings} numeric />}
      {product && (
        <View style={{ gap: 4 }}>
          <Field label={`Amount eaten (g)${product.brand ? ` · ${product.brand}` : ''}`} value={grams} onChange={changeGrams} numeric />
          <Muted>
            {product.servingSize ? `Label serving: ${product.servingSize}. ` : ''}Values from{' '}
            <Text
              style={{ textDecorationLine: 'underline' }}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(`https://world.openfoodfacts.org/product/${product.barcode}`)}
            >
              Open Food Facts
            </Text>
            , which is community-edited: check them against the pack.
          </Muted>
        </View>
      )}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Field label="Calories" value={n.calories} onChange={(v) => setN({ ...n, calories: v })} numeric />
        <Field label="Protein (g)" value={n.proteinG} onChange={(v) => setN({ ...n, proteinG: v })} numeric />
        <Field label="Fat (g)" value={n.fatG} onChange={(v) => setN({ ...n, fatG: v })} numeric />
        <Field label="Carbs (g)" value={n.carbsG} onChange={(v) => setN({ ...n, carbsG: v })} numeric />
      </View>

      {!picked && (
        <Pressable
          onPress={() => setSaveForReuse((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: saveForReuse }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}
        >
          <Switch
            value={saveForReuse}
            onValueChange={setSaveForReuse}
            trackColor={{ true: colors.text, false: colors.border }}
            thumbColor={saveForReuse ? colors.main : colors.text}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Muted>Save for reuse (macros are for one serving)</Muted>
        </Pressable>
      )}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button label="Add" onPress={save} disabled={!valid} />
        </View>
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </View>
    </View>
  )
}
