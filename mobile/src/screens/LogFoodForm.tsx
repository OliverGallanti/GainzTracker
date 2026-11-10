import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { randomUUID } from 'expo-crypto'
import { formatMacro, OTHER_MEAL, scaleFood } from '@gainz/shared/macros'
import type { Product, SavedFood } from '@gainz/shared/types'
import { useSavedFoods } from '../queries'
import { QUEUED, useQueued, type AddMealVars, type SaveFoodVars } from '../queue'
import { colors } from '../theme'
import { X } from '../icons'
import { Text, Button, Chip, Field, IconButton, Muted, animateLayout, styles } from '../ui'
import ProductLookup from './ProductLookup'

const text = (value: number | null) => (value == null ? '' : String(value))
const number = (value: string) => (value ? Number(value) : null)
const summary = (food: SavedFood) => [`${food.calories} cal`, formatMacro(food.proteinG, 'g P')].filter(Boolean).join(' · ')

// Saved foods last logged, newest first, kept on the phone only (the server
// lists them by name). ponytail: per phone, not synced; move to the server if
// the web wants the same order.
const RECENT_KEY = 'recentFoods'
const SHOWN = 5

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
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const add = useQueued<AddMealVars>(QUEUED.addMeal)
  const saveFood = useQueued<SaveFoodVars>(QUEUED.saveFood)

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((saved) => saved && setRecent(JSON.parse(saved)))
      .catch(() => {})
  }, [])

  const fillFrom = (name: string, food: Parameters<typeof scaleFood>[0], count: number) => {
    const scaled = scaleFood(food, count)
    setDescription(name)
    setN({ calories: text(scaled.calories), proteinG: text(scaled.proteinG), fatG: text(scaled.fatG), carbsG: text(scaled.carbsG) })
  }

  const pick = (food: SavedFood) => {
    animateLayout()
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
    animateLayout()
    setProduct(found)
    setPicked(null)
    setGrams(String(start))
    fillFrom(found.name, found.per100g, start / 100)
  }

  const changeGrams = (value: string) => {
    setGrams(value)
    if (product && Number(value) > 0) fillFrom(product.name, product.per100g, Number(value) / 100)
  }

  const unpick = () => {
    animateLayout()
    setPicked(null)
    setServings('1')
  }

  const save = () => {
    if (picked) {
      void AsyncStorage.setItem(RECENT_KEY, JSON.stringify([picked.id, ...recent.filter((id) => id !== picked.id)].slice(0, 50))).catch(() => {})
    }
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
  const q = query.trim().toLowerCase()
  const rank = (food: SavedFood) => {
    const i = recent.indexOf(food.id)
    return i === -1 ? Infinity : i
  }
  // Recent first, then by name (the server's order; sort is stable).
  const shown = (q ? foods.filter((food) => food.name.toLowerCase().includes(q)) : [...foods].sort((a, b) => rank(a) - rank(b))).slice(0, SHOWN)

  return (
    <View style={{ gap: 12 }}>
      {picked ? (
        <View style={[local.food, local.picked]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>{picked.name}</Text>
            <Muted>{summary(picked)} per serving</Muted>
          </View>
          <IconButton icon={X} label={`Clear ${picked.name}`} onPress={unpick} />
        </View>
      ) : (
        foods.length > 0 && (
          <View style={{ gap: 6 }}>
            <Field label="Saved foods" value={query} onChange={setQuery} placeholder="Search saved foods" />
            <View>
              {shown.map((food) => (
                <Pressable
                  key={food.id}
                  onPress={() => pick(food)}
                  accessibilityRole="button"
                  accessibilityLabel={`${food.name}, ${summary(food)}`}
                  style={({ pressed }) => [local.food, pressed && styles.dim]}
                >
                  <Text style={[styles.text, { flex: 1 }]} numberOfLines={1}>
                    {food.name}
                  </Text>
                  <Muted>{summary(food)}</Muted>
                </Pressable>
              ))}
              {shown.length === 0 && <Muted>No saved food matches “{query.trim()}”.</Muted>}
              {!q && foods.length > SHOWN && <Muted>Search to see all {foods.length}.</Muted>}
            </View>
          </View>
        )
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
          <View style={{ flex: 1 }}>
            <Muted>Save for reuse (macros are for one serving)</Muted>
          </View>
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

const local = StyleSheet.create({
  food: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border },
  picked: { paddingLeft: 12, paddingVertical: 4, paddingRight: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
})
