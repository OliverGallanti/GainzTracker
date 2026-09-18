import { useState } from 'react'
import { StatLineChart } from './StatLineChart'

const CHART_MODES = [
  { key: 'weight', label: 'Weight' },
  { key: 'bodyFat', label: 'Body fat' },
  { key: 'both', label: 'Both' },
]

const RANGE_OPTIONS = [
  { key: 'month', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '6m', label: '6M', days: 182 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: null },
]

// `chartMode` ('weight' | 'bodyFat' | 'both') and `range` are controlled by the
// card, NOT held here: this panel unmounts whenever a form is open, so state
// kept here would silently reset to its defaults every time the user logs a
// weight. `entries` must be sorted oldest-first.
function WeightCharts({ entries, weightGoal, bodyFatGoal, chartMode, onChartModeChange, range, onRangeChange }) {
  // Pinned once per mount: reading the clock during render would let the
  // cutoff drift between renders for the same selected range.
  const [now] = useState(() => Date.now())

  const bodyFatEntries = entries.filter((e) => e.bodyFatPercent != null)
  const hasBodyFatData = bodyFatEntries.length > 0

  // The range picker only zooms the charts — latest weight/BMI/goals above
  // always reflect the full history, not whatever window is currently shown.
  const rangeDays = RANGE_OPTIONS.find((r) => r.key === range)?.days
  const rangeCutoff = rangeDays ? now - rangeDays * 24 * 60 * 60 * 1000 : null
  const inRange = (e) => !rangeCutoff || new Date(e.loggedAt).getTime() >= rangeCutoff
  const rangedEntries = entries.filter(inRange)
  const rangedBodyFatEntries = bodyFatEntries.filter(inRange)
  const rangeIsEmpty = rangedEntries.length === 0

  // Only forced when both panels are shown together — a solo chart is free to
  // fit its own natural range. Computed from the ranged weight entries (weight
  // is logged on every entry) so it covers both series even if body fat was
  // only measured on a subset of weigh-ins.
  const sharedXDomain =
    chartMode === 'both' && rangedEntries.length
      ? [
          new Date(rangedEntries[0].loggedAt).getTime(),
          new Date(rangedEntries[rangedEntries.length - 1].loggedAt).getTime(),
        ]
      : undefined

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onRangeChange(r.key)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                range === r.key ? 'bg-third text-main' : 'text-third/60 hover:text-third'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {hasBodyFatData && (
          <div className="flex gap-1">
            {CHART_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onChartModeChange(m.key)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  chartMode === m.key ? 'bg-third text-main' : 'text-third/60 hover:text-third'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {rangeIsEmpty && <p className="text-xs text-third/60">No entries in this range.</p>}

      {!rangeIsEmpty && (chartMode === 'weight' || chartMode === 'both' || !hasBodyFatData) && (
        <div>
          {chartMode === 'both' && <p className="mb-1 text-xs text-third/60">Weight (kg)</p>}
          <StatLineChart
            data={rangedEntries.map((e) => ({ loggedAt: e.loggedAt, value: e.weightKg }))}
            unit="kg"
            goal={weightGoal}
            xDomain={sharedXDomain}
          />
        </div>
      )}

      {!rangeIsEmpty && hasBodyFatData && (chartMode === 'bodyFat' || chartMode === 'both') && (
        <div className={chartMode === 'both' ? 'mt-5' : ''}>
          {chartMode === 'both' && <p className="mb-1 text-xs text-third/60">Body fat (%)</p>}
          {rangedBodyFatEntries.length === 0 ? (
            <p className="text-xs text-third/60">No body fat entries in this range.</p>
          ) : (
            <StatLineChart
              data={rangedBodyFatEntries.map((e) => ({ loggedAt: e.loggedAt, value: e.bodyFatPercent }))}
              unit="%"
              goal={bodyFatGoal}
              xDomain={sharedXDomain}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default WeightCharts
