import { useState } from 'react'
import { api } from '../lib/api'
import { useSubmit, ValidationError } from '../lib/useSubmit'

// Edit the day's meal slots: rename, reorder, add (e.g. "Dessert"), remove.
function MealSlotsForm({
  mealNames,
  onSaved,
  onCancel,
}: { mealNames: string[]; onSaved: () => void; onCancel: () => void }) {
  const [names, setNames] = useState(mealNames)

  const { submit, saving, error } = useSubmit(async () => {
    const cleaned = names.map((n) => n.trim()).filter(Boolean)
    if (cleaned.length === 0) throw new ValidationError('Keep at least one meal')
    if (new Set(cleaned).size !== cleaned.length) throw new ValidationError('Meal names must be different')
    await api('/api/me', { method: 'PUT', body: JSON.stringify({ mealNames: cleaned }) })
    onSaved()
  }, 'Could not save your meals: please try again')

  const update = (index: number, value: string) => setNames(names.map((n, i) => (i === index ? value : n)))
  const remove = (index: number) => setNames(names.filter((_, i) => i !== index))
  const move = (index: number, direction: number) => {
    const target = index + direction
    if (target < 0 || target >= names.length) return
    const next = [...names]
    ;[next[index], next[target]] = [next[target], next[index]]
    setNames(next)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <span className="text-sm text-third">Meals in your day</span>
      <div className="flex flex-col gap-2">
        {names.map((name, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              required
              maxLength={30}
              value={name}
              onChange={(e) => update(index, e.target.value)}
              placeholder="e.g. Snack"
              aria-label={`Meal ${index + 1} name`}
              className="flex-1 rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
            />
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="text-third/60 hover:text-third disabled:opacity-30"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === names.length - 1}
              className="text-third/60 hover:text-third disabled:opacity-30"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={names.length === 1}
              className="text-third/60 hover:text-red-400 disabled:opacity-30"
              aria-label="Remove meal"
            >
              ✕
            </button>
          </div>
        ))}
        {names.length < 8 && (
          <button
            type="button"
            onClick={() => setNames([...names, ''])}
            className="self-start text-xs font-medium text-third/60 transition hover:text-third"
          >
            + Add meal
          </button>
        )}
      </div>
      <p className="text-xs text-third/60">
        Foods already logged today under a meal you rename or remove move to "Other".
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : 'Save meals'}
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

export default MealSlotsForm
