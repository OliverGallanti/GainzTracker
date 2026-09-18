import { useState } from 'react'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Collapsed by default so a growing history doesn't crowd the card — the full
// list is here, not a truncated "recent few".
function BigFourLogList({ entries, onRemove }) {
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0) return null

  return (
    <div className="mt-5 border-t border-secondary/25 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-xs font-medium text-third/60 transition hover:text-third"
      >
        <span>Recent logs ({entries.length})</span>
        <span>{expanded ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {expanded && (
        <ul className="mt-3 flex flex-col gap-2">
          {entries.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-secondary/25 px-3 py-2 text-sm"
            >
              <div>
                <span className="text-third">{s.exerciseName}</span>
                <span className="ml-2 text-xs text-third/60">
                  {s.weightKg}kg{s.reps ? ` × ${s.reps}` : ''} · {formatDate(s.performedAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                className="text-xs font-medium text-third/60 transition hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BigFourLogList
