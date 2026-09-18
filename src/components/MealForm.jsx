import { useState } from 'react'
import { api } from '../lib/api'
import { scaleFood } from '../lib/macros'
import { useSubmit } from '../lib/useSubmit'
import ProductLookup from './ProductLookup'

const emptyForm = { description: '', calories: '', proteinG: '', fatG: '', carbsG: '' }
const FIELD_LABELS = { proteinG: 'Protein (g)', fatG: 'Fat (g)', carbsG: 'Carbs (g)' }
const inputClass =
  'rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary'

// `savedFoods` are one-serving foods the user kept for reuse: picking one fills
// the form (times the servings), which can still be edited before adding. A
// scanned product works the same way, scaled by the grams eaten instead.
function MealForm({ mealNames, defaultMeal, savedFoods, onSaved, onCancel, onSavedFoodsChanged }) {
  const [form, setForm] = useState(emptyForm)
  const [mealName, setMealName] = useState(defaultMeal ?? '') // '' = no slot ("Other")
  const [picked, setPicked] = useState(null) // the saved food the form was filled from
  const [servings, setServings] = useState('1')
  const [product, setProduct] = useState(null) // the scanned product the form was filled from
  const [grams, setGrams] = useState('')
  const [saveForLater, setSaveForLater] = useState(false)

  // Missing values (a food that never had a macro, a product with no energy listed)
  // leave that field empty rather than writing a 0 nobody measured.
  const fillFrom = (name, food, count) => {
    const scaled = scaleFood(food, count)
    const text = (value) => (value == null ? '' : String(value))
    setForm({
      description: name,
      calories: text(scaled.calories),
      proteinG: text(scaled.proteinG),
      fatG: text(scaled.fatG),
      carbsG: text(scaled.carbsG),
    })
  }

  const pickFood = (food) => {
    setPicked(food)
    setProduct(null)
    setServings('1')
    fillFrom(food.name, food, 1)
  }

  // Start from the label's serving size when it has one, otherwise 100 g.
  const pickProduct = (found) => {
    const start = found.servingG ?? 100
    setProduct(found)
    setPicked(null)
    setGrams(String(start))
    fillFrom(found.name, found.per100g, start / 100)
  }

  const changeGrams = (value) => {
    setGrams(value)
    if (product && Number(value) > 0) fillFrom(product.name, product.per100g, Number(value) / 100)
  }

  const changeServings = (value) => {
    setServings(value)
    if (picked && Number(value) > 0) fillFrom(picked.name, picked, Number(value))
  }

  const macros = () => ({
    calories: Number(form.calories),
    ...(form.proteinG ? { proteinG: Number(form.proteinG) } : {}),
    ...(form.fatG ? { fatG: Number(form.fatG) } : {}),
    ...(form.carbsG ? { carbsG: Number(form.carbsG) } : {}),
  })

  const { submit, saving, error } = useSubmit(async () => {
    // Saved first: it's an idempotent upsert, so if logging the meal then fails
    // and the user retries, nothing ends up duplicated.
    if (saveForLater && !picked) { // a saved food is already saved
      await api('/api/saved-foods', {
        method: 'POST',
        body: JSON.stringify({ name: form.description.trim(), ...macros() }),
      })
      onSavedFoodsChanged()
    }
    await api('/api/meals', {
      method: 'POST',
      body: JSON.stringify({
        description: form.description,
        ...macros(),
        ...(mealName ? { mealName } : {}),
      }),
    })
    onSaved()
  }, 'Could not log that meal — please check the values and try again')

  const { submit: removeSavedFood, error: removeError } = useSubmit(async (food) => {
    await api(`/api/saved-foods/${food.id}`, { method: 'DELETE' })
    if (picked?.id === food.id) setPicked(null)
    onSavedFoodsChanged()
  }, 'Could not remove that saved food — please try again')

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {savedFoods.length > 0 && (
        <div>
          <span className="text-xs text-third/60">Saved foods</span>
          <ul className="mt-1 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {savedFoods.map((food) => (
              <li
                key={food.id}
                className={`flex items-center rounded-lg border text-sm ${
                  picked?.id === food.id ? 'border-third/70 bg-third/10' : 'border-secondary/25'
                }`}
              >
                <button
                  type="button"
                  onClick={() => pickFood(food)}
                  aria-pressed={picked?.id === food.id}
                  className="px-2.5 py-1 text-third transition hover:text-third/80"
                >
                  {food.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeSavedFood(food)}
                  aria-label={`Remove saved food ${food.name}`}
                  className="pr-2 text-third/40 transition hover:text-red-400"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {removeError && <p className="mt-1 text-xs text-red-400">{removeError}</p>}
        </div>
      )}

      <ProductLookup onFound={pickProduct} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Meal</span>
        <select value={mealName} onChange={(e) => setMealName(e.target.value)} className={inputClass}>
          {mealNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value="">Other</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Description</span>
        <input
          type="text"
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Chicken + rice"
          className={inputClass}
        />
      </label>

      {product && (
        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-third">
              Amount eaten (g)
              {product.brand && <span className="text-third/60"> · {product.brand}</span>}
            </span>
            <input
              type="number"
              min="1"
              step="any"
              value={grams}
              onChange={(e) => changeGrams(e.target.value)}
              className={`w-20 text-right ${inputClass}`}
            />
          </label>
          <p className="text-xs text-third/60">
            {product.servingSize ? `Label serving: ${product.servingSize}. ` : ''}
            Values from{' '}
            <a
              href={`https://world.openfoodfacts.org/product/${product.barcode}`}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-secondary/40 underline-offset-2 hover:decoration-secondary"
            >
              Open Food Facts
            </a>
            , which is community-edited — check them against the pack.
          </p>
        </div>
      )}

      {picked && (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-third">Servings of {picked.name}</span>
          <input
            type="number"
            min="0.1"
            step="any"
            value={servings}
            onChange={(e) => changeServings(e.target.value)}
            className={`w-20 text-right ${inputClass}`}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Calories</span>
        <input
          type="number"
          min="0"
          step="1"
          required
          value={form.calories}
          onChange={(e) => setForm({ ...form, calories: e.target.value })}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        {['proteinG', 'fatG', 'carbsG'].map((field) => (
          <label key={field} className="flex flex-col gap-1 text-xs">
            <span className="text-third/60">{FIELD_LABELS[field]}</span>
            <input
              type="number"
              min="0"
              step="any"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </label>
        ))}
      </div>

      {!picked && (
        <label className="flex items-center gap-1.5 text-xs text-third/60">
          <input
            type="checkbox"
            checked={saveForLater}
            onChange={(e) => setSaveForLater(e.target.checked)}
            className="accent-third"
          />
          Save for reuse (macros are for one serving)
        </label>
      )}

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </form>
  )
}

export default MealForm
