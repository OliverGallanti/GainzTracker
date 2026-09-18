import { useEffect, useState } from 'react'
import { api } from '../lib/api'
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

const emptyWeightForm = { weightKg: '', bodyFatPercent: '' }
const emptyHeightForm = { heightCm: '' }
const emptyGoalsForm = { weightGoalKg: '', bodyFatGoalPercent: '' }

function computeBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

function WeightChart() {
  const [entries, setEntries] = useState(null)
  const [height, setHeight] = useState(undefined) // undefined = loading, null = unset
  const [weightGoal, setWeightGoal] = useState(undefined)
  const [bodyFatGoal, setBodyFatGoal] = useState(undefined)
  const [mode, setMode] = useState('view') // 'view' | 'logWeight' | 'editHeight' | 'editGoals'
  const [chartMode, setChartMode] = useState('weight') // 'weight' | 'bodyFat' | 'both'
  const [range, setRange] = useState('1y')

  const [weightForm, setWeightForm] = useState(emptyWeightForm)
  const [savingWeight, setSavingWeight] = useState(false)
  const [weightError, setWeightError] = useState(null)

  const [heightForm, setHeightForm] = useState(emptyHeightForm)
  const [savingHeight, setSavingHeight] = useState(false)
  const [heightError, setHeightError] = useState(null)

  const [goalsForm, setGoalsForm] = useState(emptyGoalsForm)
  const [savingGoals, setSavingGoals] = useState(false)
  const [goalsError, setGoalsError] = useState(null)

  const load = () => {
    api('/api/weights').then((data) => {
      setEntries([...data].sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt)))
    })
    api('/api/me').then((me) => {
      setHeight(me.heightCm)
      setWeightGoal(me.weightGoalKg)
      setBodyFatGoal(me.bodyFatGoalPercent)
    })
  }

  useEffect(() => {
    load()
  }, [])

  const startLogWeight = () => {
    setWeightForm(emptyWeightForm)
    setWeightError(null)
    setMode('logWeight')
  }

  const handleSaveWeight = async (e) => {
    e.preventDefault()
    setSavingWeight(true)
    setWeightError(null)
    try {
      await api('/api/weights', {
        method: 'POST',
        body: JSON.stringify({
          weightKg: Number(weightForm.weightKg),
          ...(weightForm.bodyFatPercent ? { bodyFatPercent: Number(weightForm.bodyFatPercent) } : {}),
        }),
      })
      setMode('view')
      load()
    } catch {
      setWeightError('Could not log that weight — please check the values and try again')
    } finally {
      setSavingWeight(false)
    }
  }

  const startEditHeight = () => {
    setHeightForm({ heightCm: height ?? '' })
    setHeightError(null)
    setMode('editHeight')
  }

  const handleSaveHeight = async (e) => {
    e.preventDefault()
    setSavingHeight(true)
    setHeightError(null)
    try {
      await api('/api/me', {
        method: 'PUT',
        body: JSON.stringify({ heightCm: Number(heightForm.heightCm) }),
      })
      setMode('view')
      load()
    } catch {
      setHeightError('Could not save your height — please check the value and try again')
    } finally {
      setSavingHeight(false)
    }
  }

  const startEditGoals = () => {
    setGoalsForm({ weightGoalKg: weightGoal ?? '', bodyFatGoalPercent: bodyFatGoal ?? '' })
    setGoalsError(null)
    setMode('editGoals')
  }

  const handleSaveGoals = async (e) => {
    e.preventDefault()
    setSavingGoals(true)
    setGoalsError(null)
    try {
      await api('/api/me', {
        method: 'PUT',
        body: JSON.stringify({
          ...(goalsForm.weightGoalKg ? { weightGoalKg: Number(goalsForm.weightGoalKg) } : {}),
          ...(goalsForm.bodyFatGoalPercent ? { bodyFatGoalPercent: Number(goalsForm.bodyFatGoalPercent) } : {}),
        }),
      })
      setMode('view')
      load()
    } catch {
      setGoalsError('Could not save your goals — please check the values and try again')
    } finally {
      setSavingGoals(false)
    }
  }

  const isLoading = entries === null || height === undefined || weightGoal === undefined
  const isEmpty = entries?.length === 0
  const latestEntry = entries?.length ? entries[entries.length - 1] : null
  const latestBodyFat = entries ? [...entries].reverse().find((e) => e.bodyFatPercent != null) : null
  const bmi = latestEntry ? computeBmi(latestEntry.weightKg, height) : null
  const bodyFatEntries = entries ? entries.filter((e) => e.bodyFatPercent != null) : []
  const hasBodyFatData = bodyFatEntries.length > 0

  // The range picker only zooms the charts — latest weight/BMI/goals above
  // always reflect the full history, not whatever window is currently shown.
  const rangeDays = RANGE_OPTIONS.find((r) => r.key === range)?.days
  const rangeCutoff = rangeDays ? Date.now() - rangeDays * 24 * 60 * 60 * 1000 : null
  const inRange = (e) => !rangeCutoff || new Date(e.loggedAt).getTime() >= rangeCutoff
  const rangedEntries = entries ? entries.filter(inRange) : []
  const rangedBodyFatEntries = bodyFatEntries.filter(inRange)
  const rangeIsEmpty = !isEmpty && rangedEntries.length === 0

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
    <div className="w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-third">Weight</h2>
        {mode === 'view' && (
          <button
            type="button"
            onClick={startLogWeight}
            className="text-xs font-medium text-third/60 transition hover:text-third"
          >
            Log weight
          </button>
        )}
      </div>

      {isLoading && <p className="text-xs text-third/60">Loading…</p>}

      {!isLoading && mode === 'view' && (
        <div className="mb-4 flex flex-col gap-1 text-xs">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <div>
              <span className="text-third/60">Height </span>
              <button
                type="button"
                onClick={startEditHeight}
                className="text-third underline decoration-secondary/40 underline-offset-2 hover:decoration-secondary"
              >
                {height ? `${height} cm` : 'Set height'}
              </button>
            </div>
            {latestBodyFat && (
              <div>
                <span className="text-third/60">Body fat </span>
                <span className="text-third">{latestBodyFat.bodyFatPercent}%</span>
              </div>
            )}
            {bmi != null && (
              <div>
                <span className="text-third/60">BMI </span>
                <span className="text-third">{bmi.toFixed(1)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="text-third/60">
              Goals:{' '}
              {weightGoal || bodyFatGoal ? (
                <span className="text-third">
                  {weightGoal ? `${weightGoal}kg` : null}
                  {weightGoal && bodyFatGoal ? ' · ' : null}
                  {bodyFatGoal ? `${bodyFatGoal}% BF` : null}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={startEditGoals}
              className="text-third underline decoration-secondary/40 underline-offset-2 hover:decoration-secondary"
            >
              {weightGoal || bodyFatGoal ? 'Edit goals' : 'Set goals'}
            </button>
          </div>
        </div>
      )}

      {!isLoading && mode === 'view' && isEmpty && (
        <p className="text-xs text-third/60">No weight entries logged yet.</p>
      )}

      {!isLoading && mode === 'view' && !isEmpty && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
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
                    onClick={() => setChartMode(m.key)}
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
      )}

      {mode === 'logWeight' && (
        <form onSubmit={handleSaveWeight} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-third">Weight (kg)</span>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={weightForm.weightKg}
              onChange={(e) => setWeightForm({ ...weightForm, weightKg: e.target.value })}
              className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-third">Body fat % (optional)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={weightForm.bodyFatPercent}
              onChange={(e) => setWeightForm({ ...weightForm, bodyFatPercent: e.target.value })}
              className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
            />
          </label>

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={savingWeight}
              className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
            >
              {savingWeight ? 'Saving…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {weightError && <p className="text-center text-xs text-red-400">{weightError}</p>}
        </form>
      )}

      {mode === 'editHeight' && (
        <form onSubmit={handleSaveHeight} className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-third">Height (cm)</span>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={heightForm.heightCm}
              onChange={(e) => setHeightForm({ heightCm: e.target.value })}
              className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
            />
          </label>

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={savingHeight}
              className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
            >
              {savingHeight ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {heightError && <p className="text-center text-xs text-red-400">{heightError}</p>}
        </form>
      )}

      {mode === 'editGoals' && (
        <form onSubmit={handleSaveGoals} className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-third">Weight goal (kg)</span>
            <input
              type="number"
              min="1"
              step="any"
              value={goalsForm.weightGoalKg}
              onChange={(e) => setGoalsForm({ ...goalsForm, weightGoalKg: e.target.value })}
              className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-third">Body fat goal (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={goalsForm.bodyFatGoalPercent}
              onChange={(e) => setGoalsForm({ ...goalsForm, bodyFatGoalPercent: e.target.value })}
              className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
            />
          </label>

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={savingGoals}
              className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
            >
              {savingGoals ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {goalsError && <p className="text-center text-xs text-red-400">{goalsError}</p>}
        </form>
      )}
    </div>
  )
}

export default WeightChart
