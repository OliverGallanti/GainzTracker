import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, Pencil, Search, Star, Trash2, X, type LucideIcon } from 'lucide-react'
import {
  EMPTY_FOOD,
  eaten as eatenFor,
  fromMeal,
  fromProduct,
  fromSaved,
  perBasis,
  savedFrom,
  sortSavedFoods,
  startAmount,
  type FoodDraft,
} from '@gainz/shared/foods'
import { foodUnits, formatMacro, OTHER_MEAL } from '@gainz/shared/macros'
import type { AmountUnit, Meal, SavedFood } from '@gainz/shared/types'
import { api } from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { useSubmit, ValidationError } from '../lib/useSubmit'
import ProductLookup from './ProductLookup'

// Log food, in steps inside one dialog, like the phone: pick where the food
// comes from (My foods, the food database, or typed in), then say how much was
// eaten. Every source ends on the same Amount step, which is also where a
// logged food is edited. The food logic is shared with the phone
// (@gainz/shared/foods).

type Step = 'source' | 'mine' | 'database' | 'values' | 'amount' | 'editSaved'
const TITLES: Record<Step, string> = {
  source: 'Log food',
  mine: 'My foods',
  database: 'Food database',
  values: 'Food values',
  amount: 'Amount',
  editSaved: 'Edit saved food',
}

const INPUT = 'rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-sm text-third outline-none focus:border-secondary'
const SECTION = 'rounded-xl border border-secondary/30 p-4'
const round1 = (n: number) => Math.round(n * 10) / 10
const text = (value: number | null) => (value == null ? '' : String(round1(value)))
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))
// The API's optional fields are "absent", not null.
const withoutNulls = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, v]) => v != null))

// Saved foods last logged, newest first, kept in this browser only (the server
// lists them by name). ponytail: per browser, not synced with the phone's list.
const RECENT_KEY = 'recentFoods'
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

const SAVED_FOODS_KEY = ['savedFoods']

function LogFoodDialog({
  mealNames,
  defaultMeal,
  editing,
  onChanged,
  onClose,
}: {
  mealNames: string[]
  defaultMeal: string
  editing?: Meal // set: edit this logged food instead of logging a new one
  onChanged: () => void // today's foods changed: reload them
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [start] = useState(() => (editing ? fromMeal(editing) : null))
  const [stack, setStack] = useState<Step[]>([editing ? 'amount' : 'source'])
  const [draft, setDraft] = useState<FoodDraft>(start?.food ?? EMPTY_FOOD)
  const [amount, setAmount] = useState(start ? String(round1(start.amount)) : '')
  const [unit, setUnit] = useState<AmountUnit>(start?.unit ?? 'serving')
  const [mealName, setMealName] = useState(editing ? (editing.mealName ?? OTHER_MEAL) : defaultMeal)
  const [saveToMine, setSaveToMine] = useState(false)
  const [savedToEdit, setSavedToEdit] = useState<SavedFood | null>(null)
  const savedFoods = useLoad<SavedFood[]>(SAVED_FOODS_KEY, () => api('/api/saved-foods'))

  // Opened as a modal as soon as it mounts; Esc and the backdrop close it.
  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const step = stack[stack.length - 1]
  const previous = stack[stack.length - 2]
  const go = (next: Step) => setStack([...stack, next])
  const back = () => setStack(stack.slice(0, -1))
  const units = foodUnits(draft)

  const toAmount = (food: FoodDraft, replace = false) => {
    const begin = startAmount(food)
    setDraft(food)
    setUnit(begin.unit)
    setAmount(String(begin.amount))
    setSaveToMine(false)
    setStack([...(replace ? stack.slice(0, -1) : stack), 'amount'])
  }

  // From the values form: back to Amount when it was opened from there
  // (keeping the amount), otherwise on to it.
  const valuesDone = (food: FoodDraft) => {
    if (previous === 'amount') {
      setDraft(food)
      if (!foodUnits(food).includes(unit)) setUnit(foodUnits(food)[0])
      back()
    } else toAmount(food, true)
  }

  const result = eatenFor(draft, Number(amount), unit)
  const valid = result != null && result.calories != null && draft.name.trim() !== ''

  const { submit, saving, error } = useSubmit(async () => {
    if (!result || result.calories == null) throw new ValidationError('Enter how much you ate')
    const values = {
      description: draft.name.trim(),
      calories: result.calories,
      proteinG: result.proteinG,
      fatG: result.fatG,
      carbsG: result.carbsG,
      mealName: mealName === OTHER_MEAL ? null : mealName,
      amount: Number(amount),
      unit,
    }
    if (editing) {
      await api(`/api/meals/${editing.id}`, { method: 'PATCH', body: JSON.stringify(values) })
    } else {
      // Saved first: it's an upsert by name, so a retry after the meal fails
      // duplicates nothing.
      if (saveToMine) {
        await api('/api/saved-foods', { method: 'POST', body: JSON.stringify(withoutNulls(savedFrom(draft))) })
        savedFoods.reload()
      }
      await api('/api/meals', { method: 'POST', body: JSON.stringify(withoutNulls(values)) })
      if (draft.savedId) {
        const recent = [draft.savedId, ...readRecent().filter((id) => id !== draft.savedId)].slice(0, 50)
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
        } catch {
          // storage full or blocked: the order just isn't remembered
        }
      }
    }
    onChanged()
    dialog.current?.close()
  }, editing ? 'Could not save that change: please try again' : 'Could not log that food: please try again')

  const { submit: deleteLogged, saving: deleting } = useSubmit(async () => {
    if (!editing) return
    await api(`/api/meals/${editing.id}`, { method: 'DELETE' })
    onChanged()
    dialog.current?.close()
  }, 'Could not delete that food: please try again')

  const saved = useSubmit(async (food: FoodDraft | null) => {
    if (!savedToEdit) return
    if (food) {
      await api(`/api/saved-foods/${savedToEdit.id}`, { method: 'PUT', body: JSON.stringify(withoutNulls(savedFrom(food))) })
    } else {
      await api(`/api/saved-foods/${savedToEdit.id}`, { method: 'DELETE' })
    }
    savedFoods.reload()
    back()
  }, 'Could not save that food: is the name already used by another saved food?')

  return (
    <dialog
      ref={dialog}
      aria-labelledby="log-food-title"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()} // click on the backdrop
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-secondary/40 bg-card p-5 text-left text-third shadow-2xl shadow-black/60 backdrop:bg-black/60 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        {stack.length > 1 && <IconButton icon={ChevronLeft} label="Back" onClick={back} />}
        <h2 id="log-food-title" className="flex-1 truncate text-base font-semibold">
          {editing && step === 'amount' ? 'Edit food' : TITLES[step]}
        </h2>
        <IconButton icon={X} label="Close" onClick={() => dialog.current?.close()} />
      </div>

      {step === 'source' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-third/60">Where does the food come from?</p>
          <SourceOption icon={Star} title="My foods" detail="Foods you saved before" onClick={() => go('mine')} />
          <SourceOption icon={Search} title="Search food database" detail="By name or barcode" onClick={() => go('database')} />
          <SourceOption
            icon={Pencil}
            title="Enter manually"
            detail="Type the nutrition values yourself"
            onClick={() => {
              setDraft(EMPTY_FOOD)
              go('values')
            }}
          />
        </div>
      )}

      {step === 'mine' && (
        <MyFoods
          foods={savedFoods.data}
          failed={savedFoods.error}
          onRetry={savedFoods.reload}
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
          submitLabel={saved.saving ? 'Saving…' : 'Save'}
          onSubmit={(food) => saved.submit(food)}
          onDelete={() => saved.submit(null)}
          error={saved.error}
        />
      )}

      {step === 'amount' && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <section className={SECTION}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{draft.name || 'Unnamed food'}</h3>
                {draft.brand && <p className="text-xs text-third/60">{draft.brand}</p>}
                <p className="text-xs text-third/60">{perBasis(draft)}</p>
              </div>
              <button type="button" onClick={() => go('values')} className="btn btn-secondary shrink-0">
                <Pencil size={12} />
                Edit values
              </button>
            </div>
            {draft.barcode && (
              <p className="mt-2 text-xs text-third/60">
                {draft.servingSize ? `Label serving: ${draft.servingSize}. ` : ''}Values from{' '}
                <a
                  href={`https://world.openfoodfacts.org/product/${draft.barcode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:no-underline"
                >
                  Open Food Facts
                </a>
                , which anyone can edit: check them against the pack.
              </p>
            )}
          </section>

          <section className={SECTION}>
            <h3 className="mb-2 text-sm font-semibold">How much did you eat?</h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label={unit === 'g' ? 'Grams' : 'Servings'}
                className={`w-28 ${INPUT}`}
              />
              {units.length > 1 ? (
                <div className="flex gap-1" role="group" aria-label="Unit">
                  {units.map((u) => (
                    <Toggle key={u} selected={unit === u} onClick={() => setUnit(u)}>
                      {u === 'g' ? 'g' : 'servings'}
                    </Toggle>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-third/60">{unit === 'g' ? 'g' : 'servings'}</span>
              )}
            </div>
            {units.length === 1 && (
              <p className="mt-2 text-xs text-third/60">
                {draft.basis === '100g'
                  ? 'To log it in servings, add a serving weight in Edit values.'
                  : 'To log it in grams, add the weight of one serving in Edit values.'}
              </p>
            )}
            <div className="mt-3 rounded-lg bg-main px-3 py-2" aria-live="polite">
              {result && result.calories != null ? (
                <>
                  <p className="text-xl font-bold">{result.calories} cal</p>
                  <p className="text-xs text-third/60">
                    {[formatMacro(result.proteinG, ' g protein'), formatMacro(result.fatG, ' g fat'), formatMacro(result.carbsG, ' g carbs')]
                      .filter(Boolean)
                      .join(' · ') || 'No macros listed'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-third/60">
                  {draft.calories == null ? 'This food has no calories: add them in Edit values.' : 'Enter how much you ate.'}
                </p>
              )}
            </div>
          </section>

          <section className={SECTION}>
            <h3 className="mb-2 text-sm font-semibold">Meal</h3>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meal">
              {[...mealNames, OTHER_MEAL].map((name) => (
                <Toggle key={name} selected={mealName === name} onClick={() => setMealName(name)}>
                  {name}
                </Toggle>
              ))}
            </div>
          </section>

          {!editing && !draft.savedId && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={saveToMine} onChange={(e) => setSaveToMine(e.target.checked)} className="size-4 accent-third" />
              <span>
                Save to My foods <span className="text-xs text-third/60">to log it again in two clicks</span>
              </span>
            </label>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={!valid || saving} className="btn btn-primary flex-1 py-2 text-sm disabled:opacity-60">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add'}
            </button>
            {editing && (
              <button type="button" onClick={() => deleteLogged()} disabled={deleting} className="btn btn-secondary py-2 text-sm hover:text-red-400">
                <Trash2 size={14} />
                Delete
              </button>
            )}
          </div>
        </form>
      )}
    </dialog>
  )
}

function IconButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-secondary/40 text-third transition hover:border-secondary"
    >
      <Icon size={16} />
    </button>
  )
}

function Toggle({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        selected ? 'border-third bg-third font-semibold text-main' : 'border-secondary/40 text-third hover:border-secondary'
      }`}
    >
      {children}
    </button>
  )
}

function SourceOption({ icon: Icon, title, detail, onClick }: { icon: LucideIcon; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-secondary/40 bg-main/40 px-4 py-3.5 text-left transition hover:border-secondary active:scale-[0.99]"
    >
      <Icon size={20} className="shrink-0" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-third/60">{detail}</span>
      </span>
    </button>
  )
}

function MyFoods({
  foods,
  failed,
  onRetry,
  onPick,
  onEdit,
}: {
  foods: SavedFood[] | undefined
  failed: boolean
  onRetry: () => void
  onPick: (food: SavedFood) => void
  onEdit: (food: SavedFood) => void
}) {
  const [query, setQuery] = useState('')
  const [recent] = useState(readRecent)

  if (failed && !foods) {
    return (
      <p className="text-xs text-red-400">
        Could not load your saved foods:{' '}
        <button type="button" onClick={onRetry} className="underline hover:no-underline">
          retry
        </button>
      </p>
    )
  }
  if (!foods) return <p className="text-xs text-third/60">Loading…</p>
  if (foods.length === 0) {
    return <p className="text-sm text-third/60">No saved foods yet. When you log a food, tick “Save to My foods” and it shows up here.</p>
  }

  const shown = sortSavedFoods(foods, recent, query)
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${foods.length} saved foods`}
        aria-label="Search my foods"
        className={INPUT}
      />
      <ul className="divide-y divide-secondary/20">
        {shown.map((food) => (
          <li key={food.id} className="flex items-center gap-2">
            <button type="button" onClick={() => onPick(food)} className="min-w-0 flex-1 py-2.5 text-left transition hover:opacity-80">
              <span className="block truncate text-sm">{food.name}</span>
              <span className="block text-xs text-third/60">{perBasis(fromSaved(food))}</span>
            </button>
            <IconButton icon={Pencil} label={`Edit ${food.name}`} onClick={() => onEdit(food)} />
          </li>
        ))}
        {shown.length === 0 && <li className="py-2 text-xs text-third/60">No saved food matches “{query.trim()}”.</li>}
      </ul>
    </div>
  )
}

// A food's name and values: typed in, corrected, or a saved food being edited.
function ValuesForm({
  draft,
  submitLabel,
  onSubmit,
  onDelete,
  error,
}: {
  draft: FoodDraft
  submitLabel: string
  onSubmit: (food: FoodDraft) => void
  onDelete?: () => void
  error?: string | null
}) {
  const [name, setName] = useState(draft.name)
  const [basis, setBasis] = useState(draft.basis)
  const [servingG, setServingG] = useState(text(draft.servingG))
  const [n, setN] = useState({ calories: text(draft.calories), proteinG: text(draft.proteinG), fatG: text(draft.fatG), carbsG: text(draft.carbsG) })

  const valid = name.trim() !== '' && n.calories !== '' && Number(n.calories) >= 0 && (servingG === '' || Number(servingG) > 0)
  const field = (key: keyof typeof n, label: string) => (
    <label className="flex flex-col gap-1 text-xs text-third/60">
      {label}
      <input type="number" min="0" step="any" value={n[key]} onChange={(e) => setN({ ...n, [key]: e.target.value })} className={INPUT} />
    </label>
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
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
      }}
      className="flex flex-col gap-4"
    >
      <section className={SECTION}>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken and rice" className={`font-normal ${INPUT}`} />
        </label>
      </section>

      <section className={`flex flex-col gap-3 ${SECTION}`}>
        <h3 className="text-sm font-semibold">Nutrition values</h3>
        <div>
          <p className="mb-1 text-xs text-third/60">The values below are for</p>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="The values are for">
            <Toggle selected={basis === '100g'} onClick={() => setBasis('100g')}>
              100 g
            </Toggle>
            <Toggle selected={basis === 'serving'} onClick={() => setBasis('serving')}>
              1 serving
            </Toggle>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs text-third/60">
          {basis === '100g' ? 'Serving weight in g (optional): lets you log it in servings too' : 'Weight of one serving in g (optional): lets you log it in grams too'}
          <input type="number" min="0" step="any" value={servingG} onChange={(e) => setServingG(e.target.value)} className={INPUT} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {field('calories', 'Calories')}
          {field('proteinG', 'Protein (g)')}
          {field('fatG', 'Fat (g)')}
          {field('carbsG', 'Carbs (g)')}
        </div>
      </section>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!valid} className="btn btn-primary flex-1 py-2 text-sm disabled:opacity-60">
          {submitLabel}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="btn btn-secondary py-2 text-sm hover:text-red-400">
            <Trash2 size={14} />
            Delete saved food
          </button>
        )}
      </div>
    </form>
  )
}

export default LogFoodDialog
