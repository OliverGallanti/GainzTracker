import { useState } from 'react'
import { uniqueDays } from '../lib/splits'

// Pick which of the split's days you did, then mark it done or skipped. Used for
// today and for filling in past days. `suggestedIndex` only preselects a chip.
function DayLogForm({ days, suggestedIndex, disabled, onLog }) {
  const options = uniqueDays(days)
  const [picked, setPicked] = useState(null)
  const selected = picked ?? days.indexOf(days[suggestedIndex])

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {options.map(({ label, index }) => (
          <button
            key={index}
            type="button"
            onClick={() => setPicked(index)}
            aria-pressed={selected === index}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              selected === index
                ? 'border-third/70 bg-third/10 text-third'
                : 'border-secondary/25 text-third/60 hover:border-secondary hover:text-third'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onLog(selected, true)}
          disabled={disabled}
          className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
        >
          Mark done
        </button>
        <button
          type="button"
          onClick={() => onLog(selected, false)}
          disabled={disabled}
          className="flex-1 rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary disabled:opacity-60 active:scale-[0.98]"
        >
          Mark skipped
        </button>
      </div>
    </div>
  )
}

export default DayLogForm
