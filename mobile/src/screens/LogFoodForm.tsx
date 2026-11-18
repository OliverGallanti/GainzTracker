import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { randomUUID } from 'expo-crypto'
import { loggedAtOn } from '@gainz/shared/dates'
import { EMPTY_FOOD, eaten as eatenFor, fromMeal, fromProduct, fromSaved, perBasis, savedFrom, sortSavedFoods, startAmount, type FoodDraft } from '@gainz/shared/foods'
import { foodUnits, formatMacro, OTHER_MEAL } from '@gainz/shared/macros'
import type { AmountUnit, Meal, SavedFood } from '@gainz/shared/types'
import type { LucideIcon } from 'lucide-react-native'
import { Pencil, Search, Star, Trash2 } from '../icons'
import { useSavedFoods } from '../queries'
import { QUEUED, useQueued, type AddMealVars, type RemoveVars, type SaveFoodVars, type UpdateMealVars, type UpdateSavedFoodVars } from '../queue'
import { colors } from '../theme'
import { Text, Button, Card, Chip, Field, IconButton, Muted, Sheet, animateLayout, styles } from '../ui'
import ProductLookup from './ProductLookup'

// Log food, in steps inside one full-screen sheet: pick where the food comes
// from (My foods, the food database, or typed in), then say how much was eaten.
// Every source ends on the same Amount page, which is also where a logged food
// is edited. Writes are queued (queue.ts): they show up straight away and are
// sent now, or when the phone is back online.

type Step = 'source' | 'mine' | 'database' | 'values' | 'amount' | 'editSaved'
const TITLES: Record<Step, string> = {
  source: 'Log food',
  mine: 'My foods',
  database: 'Food database',
  values: 'Food values',
  amount: 'Amount',
  editSaved: 'Edit saved food',
}

const round1 = (n: number) => Math.round(n * 10) / 10
const text = (value: number | null) => (value == null ? '' : String(round1(value)))
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))
// Saved foods last logged, newest first, kept on the phone only (the server
// lists them by name). ponytail: per phone, not synced; move to the server if
// the web wants the same order.
const RECENT_KEY = 'recentFoods'

export default function LogFood({
  mealNames,
  defaultMeal,
  editing,
  day,
  onClose,
}: {
  mealNames: string[]
  defaultMeal: string
  editing?: Meal // set: edit this logged food instead of logging a new one
  day: Date // the day a new food is logged on
  onClose: () => void
}) {
  const [start] = useState(() => (editing ? fromMeal(editing) : null))
  const [stack, setStack] = useState<Step[]>([editing ? 'amount' : 'source'])
  const [draft, setDraft] = useState<FoodDraft>(start?.food ?? EMPTY_FOOD)
  const [amount, setAmount] = useState(start ? String(round1(start.amount)) : '')
  const [unit, setUnit] = useState<AmountUnit>(start?.unit ?? 'serving')
  const [mealName, setMealName] = useState(editing ? (editing.mealName ?? OTHER_MEAL) : defaultMeal)
  const [saveToMine, setSaveToMine] = useState(false)
  const [savedToEdit, setSavedToEdit] = useState<SavedFood | null>(null)
  const [recent, setRecent] = useState<string[]>([])

  const add = useQueued<AddMealVars>(QUEUED.addMeal)
  const update = useQueued<UpdateMealVars>(QUEUED.updateMeal)
  const remove = useQueued<RemoveVars>(QUEUED.remove)
  const saveFood = useQueued<SaveFoodVars>(QUEUED.saveFood)
  const updateSaved = useQueued<UpdateSavedFoodVars>(QUEUED.updateSavedFood)

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((saved) => saved && setRecent(JSON.parse(saved)))
      .catch(() => {})
  }, [])

  const step = stack[stack.length - 1]
  const previous = stack[stack.length - 2]
  const go = (next: Step) => animateLayout(() => setStack([...stack, next]))
  const back = stack.length > 1 ? () => animateLayout(() => setStack(stack.slice(0, -1))) : undefined
  const units = foodUnits(draft)

  // A new food on the Amount page starts at one serving, or the label's
  // serving, or 100 g. `replace`: the step it came from is done (typed values).
  const toAmount = (food: FoodDraft, replace = false) => {
    const begin = startAmount(food)
    setDraft(food)
    setUnit(begin.unit)
    setAmount(String(begin.amount))
    setSaveToMine(false)
    animateLayout(() => setStack([...(replace ? stack.slice(0, -1) : stack), 'amount']))
  }

  // From the values form: back to Amount when it was opened from there
  // (keeping the amount), otherwise on to it.
  const valuesDone = (food: FoodDraft) => {
    if (previous === 'amount') {
      setDraft(food)
      if (!foodUnits(food).includes(unit)) setUnit(foodUnits(food)[0])
      back?.()
    } else toAmount(food, true)
  }

  const eaten = eatenFor(draft, Number(amount), unit)
  const valid = eaten != null && eaten.calories != null && draft.name.trim() !== ''

  const submit = () => {
    if (!valid) return
    const values = {
      description: draft.name.trim(),
      calories: eaten.calories!,
      proteinG: eaten.proteinG,
      fatG: eaten.fatG,
      carbsG: eaten.carbsG,
      mealName: mealName === OTHER_MEAL ? null : mealName,
      amount: Number(amount),
      unit,
    }
    if (editing) {
      update.mutate({ label: values.description, id: editing.id, changes: values })
    } else {
      add.mutate({ label: values.description, meal: { id: randomUUID(), ...values, loggedAt: loggedAtOn(day) } })
      if (saveToMine) saveFood.mutate({ label: `Save ${values.description}`, food: savedFrom(draft) })
      if (draft.savedId) {
        const ids = [draft.savedId, ...recent.filter((id) => id !== draft.savedId)].slice(0, 50)
        void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(ids)).catch(() => {})
      }
    }
    onClose()
  }

  const deleteLogged = () => {
    if (!editing) return
    remove.mutate({ label: `Remove ${editing.description}`, path: `/api/meals/${editing.id}`, cacheKey: ['today'], id: editing.id })
    onClose()
  }

  return (
    <Sheet visible title={editing && step === 'amount' ? 'Edit food' : TITLES[step]} onClose={onClose} onBack={back}>
      {step === 'source' && (
        <>
          <Muted>Where does the food come from?</Muted>
          <SourceOption icon={Star} title="My foods" detail="Foods you saved before" onPress={() => go('mine')} />
          <SourceOption icon={Search} title="Search food database" detail="By name or barcode" onPress={() => go('database')} />
          <SourceOption
            icon={Pencil}
            title="Enter manually"
            detail="Type the nutrition values yourself"
            onPress={() => {
              setDraft(EMPTY_FOOD)
              go('values')
            }}
          />
        </>
      )}

      {step === 'mine' && (
        <MyFoods
          recent={recent}
          onPick={(food) => toAmount(fromSaved(food))}
          onEdit={(food) => {
            setSavedToEdit(food)
            go('editSaved')
          }}
        />
      )}

      {step === 'database' && <ProductLookup onFound={(product) => toAmount(fromProduct(product))} />}

      {step === 'values' && <ValuesForm draft={draft} submitLabel={previous === 'amount' ? 'Done' : 'Next'} onSubmit={valuesDone} />}

      {step === 'editSaved' && savedToEdit && (
        <ValuesForm
          draft={fromSaved(savedToEdit)}
          submitLabel="Save"
          onSubmit={(food) => {
            updateSaved.mutate({ label: `Save ${food.name}`, food: { id: savedToEdit.id, ...savedFrom(food) } })
            back?.()
          }}
          onDelete={() => {
            remove.mutate({ label: `Remove ${savedToEdit.name}`, path: `/api/saved-foods/${savedToEdit.id}`, cacheKey: ['savedFoods'], id: savedToEdit.id })
            back?.()
          }}
        />
      )}

      {step === 'amount' && (
        <>
          <Card title={draft.name || 'Unnamed food'} right={<Button label="Edit values" icon={Pencil} variant="small" onPress={() => go('values')} />}>
            {draft.brand && <Muted>{draft.brand}</Muted>}
            <Muted>{perBasis(draft)}</Muted>
            {draft.barcode && (
              <Muted>
                {draft.servingSize ? `Label serving: ${draft.servingSize}. ` : ''}Values from{' '}
                <Text
                  style={{ textDecorationLine: 'underline' }}
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(`https://world.openfoodfacts.org/product/${draft.barcode}`)}
                >
                  Open Food Facts
                </Text>
                , which anyone can edit: check them against the pack.
              </Muted>
            )}
          </Card>

          <Card title="How much did you eat?">
            <View style={[styles.row, { alignItems: 'flex-end' }]}>
              <Field label={unit === 'g' ? 'Grams' : 'Servings'} value={amount} onChange={setAmount} numeric />
              {units.length > 1 && (
                <View style={styles.row}>
                  {units.map((u) => (
                    <Chip key={u} label={u === 'g' ? 'g' : 'servings'} selected={unit === u} onPress={() => setUnit(u)} />
                  ))}
                </View>
              )}
            </View>
            {units.length === 1 && (
              <Muted>
                {draft.basis === '100g'
                  ? 'To log it in servings, add a serving weight in Edit values.'
                  : 'To log it in grams, add the weight of one serving in Edit values.'}
              </Muted>
            )}
            <View style={local.total}>
              {eaten && eaten.calories != null ? (
                <>
                  <Text style={local.totalCalories}>{eaten.calories} cal</Text>
                  <Muted>
                    {[formatMacro(eaten.proteinG, ' g protein'), formatMacro(eaten.fatG, ' g fat'), formatMacro(eaten.carbsG, ' g carbs')]
                      .filter(Boolean)
                      .join(' · ') || 'No macros listed'}
                  </Muted>
                </>
              ) : (
                <Muted>{draft.calories == null ? 'This food has no calories: add them in Edit values.' : 'Enter how much you ate.'}</Muted>
              )}
            </View>
          </Card>

          <Card title="Meal">
            <View style={styles.chips}>
              {[...mealNames, OTHER_MEAL].map((name) => (
                <Chip key={name} label={name} selected={mealName === name} onPress={() => setMealName(name)} />
              ))}
            </View>
          </Card>

          {!editing && !draft.savedId && (
            <Pressable
              onPress={() => setSaveToMine((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: saveToMine }}
              style={local.switchRow}
            >
              <Switch
                value={saveToMine}
                onValueChange={setSaveToMine}
                trackColor={{ true: colors.text, false: colors.border }}
                thumbColor={saveToMine ? colors.main : colors.text}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>Save to My foods</Text>
                <Muted>To log it again in two taps.</Muted>
              </View>
            </Pressable>
          )}

          <Button label={editing ? 'Save changes' : 'Add'} onPress={submit} disabled={!valid} />
          {editing && <Button label="Delete this food" icon={Trash2} variant="secondary" onPress={deleteLogged} />}
        </>
      )}
    </Sheet>
  )
}

function SourceOption({ icon: Icon, title, detail, onPress }: { icon: LucideIcon; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${detail}`}
      style={({ pressed }) => [local.option, pressed && styles.dim]}
    >
      <Icon size={22} color={colors.text} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={local.optionTitle}>{title}</Text>
        <Muted>{detail}</Muted>
      </View>
    </Pressable>
  )
}

function MyFoods({ recent, onPick, onEdit }: { recent: string[]; onPick: (food: SavedFood) => void; onEdit: (food: SavedFood) => void }) {
  const savedFoods = useSavedFoods()
  const [query, setQuery] = useState('')
  const foods = savedFoods.data ?? []
  // Recently logged first, then by name (the server's order).
  const shown = sortSavedFoods(foods, recent, query)

  if (savedFoods.isPending) return <Muted>Loading…</Muted>
  if (foods.length === 0) {
    return <Muted>No saved foods yet. When you log a food, turn on “Save to My foods” and it shows up here.</Muted>
  }
  return (
    <>
      <Field label="Search my foods" value={query} onChange={setQuery} placeholder={`${foods.length} saved`} />
      <View>
        {shown.map((food) => (
          <View key={food.id} style={local.food}>
            <Pressable
              onPress={() => onPick(food)}
              accessibilityRole="button"
              accessibilityLabel={`Log ${food.name}, ${perBasis(fromSaved(food))}`}
              style={({ pressed }) => [{ flex: 1, paddingVertical: 8 }, pressed && styles.dim]}
            >
              <Text style={styles.text}>{food.name}</Text>
              <Muted>{perBasis(fromSaved(food))}</Muted>
            </Pressable>
            {/* A food saved offline has no server id yet, so it can't be edited until it syncs. */}
            {!food.id.startsWith('unsent:') && <IconButton icon={Pencil} label={`Edit ${food.name}`} onPress={() => onEdit(food)} />}
          </View>
        ))}
        {shown.length === 0 && <Muted>No saved food matches “{query.trim()}”.</Muted>}
      </View>
    </>
  )
}

// A food's name and values: typed in, corrected, or a saved food being edited.
function ValuesForm({
  draft,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  draft: FoodDraft
  submitLabel: string
  onSubmit: (food: FoodDraft) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(draft.name)
  const [basis, setBasis] = useState(draft.basis)
  const [servingG, setServingG] = useState(text(draft.servingG))
  const [n, setN] = useState({ calories: text(draft.calories), proteinG: text(draft.proteinG), fatG: text(draft.fatG), carbsG: text(draft.carbsG) })

  const valid = name.trim() !== '' && n.calories !== '' && Number(n.calories) >= 0 && (servingG === '' || Number(servingG) > 0)
  const submit = () =>
    onSubmit({
      ...draft,
      name: name.trim(),
      basis,
      servingG: numberOrNull(servingG),
      calories: Number(n.calories),
      proteinG: numberOrNull(n.proteinG),
      fatG: numberOrNull(n.fatG),
      carbsG: numberOrNull(n.carbsG),
    })

  return (
    <>
      <Card title="Food">
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Chicken and rice" />
      </Card>

      <Card title="Nutrition values">
        <Text style={styles.label}>The values below are for</Text>
        <View style={styles.row}>
          <Chip label="100 g" selected={basis === '100g'} onPress={() => setBasis('100g')} style={local.half} />
          <Chip label="1 serving" selected={basis === 'serving'} onPress={() => setBasis('serving')} style={local.half} />
        </View>
        <Field
          label={basis === '100g' ? 'Serving weight in g (optional)' : 'Weight of one serving in g (optional)'}
          value={servingG}
          onChange={setServingG}
          numeric
          placeholder={basis === '100g' ? 'Lets you log it in servings too' : 'Lets you log it in grams too'}
        />
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Field label="Calories" value={n.calories} onChange={(v) => setN({ ...n, calories: v })} numeric />
          <Field label="Protein (g)" value={n.proteinG} onChange={(v) => setN({ ...n, proteinG: v })} numeric />
          <Field label="Fat (g)" value={n.fatG} onChange={(v) => setN({ ...n, fatG: v })} numeric />
          <Field label="Carbs (g)" value={n.carbsG} onChange={(v) => setN({ ...n, carbsG: v })} numeric />
        </View>
      </Card>

      <Button label={submitLabel} onPress={submit} disabled={!valid} />
      {onDelete && <Button label="Delete saved food" icon={Trash2} variant="secondary" onPress={onDelete} />}
    </>
  )
}

const local = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  food: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  half: { flex: 1, alignItems: 'center' },
  total: { gap: 2, padding: 12, borderRadius: 12, backgroundColor: colors.main },
  totalCalories: { fontSize: 22, fontWeight: '700', color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
})
