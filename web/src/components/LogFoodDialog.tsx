import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Pencil, Search, Star, Trash2, X } from 'lucide-react'
import { loggedAtOn } from '@gainz/shared/dates'
import { EMPTY_FOOD, eaten as eatenFor, fromMeal, fromProduct, fromSaved, perBasis, savedFrom, startAmount, type FoodDraft } from '@gainz/shared/foods'
import { foodUnits, formatMacro, OTHER_MEAL } from '@gainz/shared/macros'
import type { AmountUnit, Meal, SavedFood } from '@gainz/shared/types'
import { api } from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { useSubmit, ValidationError } from '../lib/useSubmit'
import ProductLookup from './ProductLookup'
import { INPUT, SECTION, round1, withoutNulls, RECENT_KEY, readRecent, SAVED_FOODS_KEY } from './logFood/common'
import { IconButton, Toggle, SourceOption } from './logFood/parts'
import MyFoods from './logFood/MyFoods'
import ValuesForm from './logFood/ValuesForm'

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
function LogFoodDialog({
  mealNames,
  defaultMeal,
  editing,
  day,
  onChanged,
  onClose,
}: {
  mealNames: string[]
  defaultMeal: string
  editing?: Meal // set: edit this logged food instead of logging a new one
  day: Date // the day a new food is logged on
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
      await api('/api/meals', { method: 'POST', body: JSON.stringify(withoutNulls({ ...values, loggedAt: loggedAtOn(day) })) })
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

export default LogFoodDialog
