import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { FoodDraft } from '@gainz/shared/foods'
import { INPUT, SECTION, text, numberOrNull } from './common'
import { Toggle } from './parts'

// A food's name and values: typed in, corrected, or a saved food being edited.
export default function ValuesForm({
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
