import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { fromSaved, perBasis, sortSavedFoods } from '@gainz/shared/foods'
import type { SavedFood } from '@gainz/shared/types'
import { INPUT, readRecent } from './common'
import { IconButton } from './parts'

export default function MyFoods({
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
