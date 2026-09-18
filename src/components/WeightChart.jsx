import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../lib/api'

// Chart chrome mapped to the app's theme tokens (index.css) rather than
// Recharts' bright defaults — a single series needs no legend (the card title
// already says what's plotted), so the only color decision is the line itself
// (third, the app's primary-ink accent) against recessive gridlines. Resolved
// to plain hex (not CSS var references) since Recharts renders these as SVG
// attributes, which don't resolve var() the way DOM/CSS properties do.
const GRID_COLOR = '#244a55' // secondary blended ~25% into main — matches border-secondary/25
const AXIS_COLOR = '#869b9e' // third blended ~60% into main — matches text-third/60
const LINE_COLOR = '#dce0d9' // third
const TOOLTIP_BG = '#16495d' // card, solid (not the card's translucent bg)
const TOOLTIP_BORDER = '#40656d' // secondary blended ~40% into card — matches border-secondary/40

const CHART_MODES = [
  { key: 'weight', label: 'Weight' },
  { key: 'bodyFat', label: 'Body fat' },
  { key: 'both', label: 'Both' },
]

const emptyWeightForm = { weightKg: '', bodyFatPercent: '' }
const emptyHeightForm = { heightCm: '' }
const emptyGoalsForm = { weightGoalKg: '', bodyFatGoalPercent: '' }

function formatDateTick(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function computeBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

function TooltipContent({ active, payload, label, unit = 'kg', decimals = 1 }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ backgroundColor: TOOLTIP_BG, borderColor: TOOLTIP_BORDER }}
    >
      <p className="text-third/60">{formatDateTick(label)}</p>
      <p className="font-semibold text-third">
        {payload[0].value.toFixed(decimals)} {unit}
      </p>
    </div>
  )
}

// Weight and body fat are plotted as two separate charts, never one chart
// with two y-axes — a dual-axis chart with different units/scales misstates
// how the two series relate, so "Both" mode stacks two independent panels
// instead (each still just one series, one axis). They stay comparable "at a
// glance" by sharing a real time-scaled x-axis (a numeric domain in ms, not
// Recharts' default category axis, which spaces points evenly by array index
// — that would silently misalign the two panels the moment one series has a
// reading the other doesn't, e.g. a weigh-in with no body-fat reading).
function BodyStatChart({ data, dataKey, unit, goal, xDomain, decimals = 1 }) {
  // The default 'dataMin'/'dataMax' domain only looks at plotted points, so a
  // goal reference line outside that range would render off-screen — e.g. a
  // 75kg goal against 80-84kg of actual entries. Compute the domain from both
  // the data AND the goal so the reference line is always on-screen.
  const values = data.map((d) => d[dataKey]).filter((v) => v != null)
  const allValues = goal != null ? [...values, goal] : values
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const padding = Math.max((max - min) * 0.1, 1)
  const yDomain = [Math.floor(min - padding), Math.ceil(max + padding)]

  return (
    <div className="h-40 sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey={(d) => new Date(d.loggedAt).getTime()}
            type="number"
            domain={xDomain ?? ['dataMin', 'dataMax']}
            tickFormatter={formatDateTick}
            stroke={AXIS_COLOR}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID_COLOR }}
            minTickGap={32}
          />
          <YAxis
            stroke={AXIS_COLOR}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={yDomain}
          />
          <Tooltip content={<TooltipContent unit={unit} decimals={decimals} />} cursor={{ stroke: GRID_COLOR }} />
          {goal != null && (
            <ReferenceLine
              y={goal}
              stroke={AXIS_COLOR}
              strokeDasharray="4 4"
              label={{ value: 'Goal', position: 'insideTopRight', fill: AXIS_COLOR, fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={{ r: 4, fill: LINE_COLOR, stroke: TOOLTIP_BG, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: LINE_COLOR, stroke: TOOLTIP_BG, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function WeightChart() {
  const [entries, setEntries] = useState(null)
  const [height, setHeight] = useState(undefined) // undefined = loading, null = unset
  const [weightGoal, setWeightGoal] = useState(undefined)
  const [bodyFatGoal, setBodyFatGoal] = useState(undefined)
  const [mode, setMode] = useState('view') // 'view' | 'logWeight' | 'editHeight' | 'editGoals'
  const [chartMode, setChartMode] = useState('weight') // 'weight' | 'bodyFat' | 'both'

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
  // Only forced when both panels are shown together — a solo chart is free to
  // fit its own natural range. Computed from the full entries array (weight
  // is logged on every entry) so it covers both series even if body fat was
  // only measured on a subset of weigh-ins.
  const sharedXDomain =
    chartMode === 'both' && entries?.length
      ? [
          new Date(entries[0].loggedAt).getTime(),
          new Date(entries[entries.length - 1].loggedAt).getTime(),
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
          {hasBodyFatData && (
            <div className="mb-3 flex justify-end gap-1">
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

          {(chartMode === 'weight' || chartMode === 'both' || !hasBodyFatData) && (
            <div>
              {chartMode === 'both' && <p className="mb-1 text-xs text-third/60">Weight (kg)</p>}
              <BodyStatChart data={entries} dataKey="weightKg" unit="kg" goal={weightGoal} xDomain={sharedXDomain} />
            </div>
          )}

          {hasBodyFatData && (chartMode === 'bodyFat' || chartMode === 'both') && (
            <div className={chartMode === 'both' ? 'mt-5' : ''}>
              {chartMode === 'both' && <p className="mb-1 text-xs text-third/60">Body fat (%)</p>}
              <BodyStatChart
                data={bodyFatEntries}
                dataKey="bodyFatPercent"
                unit="%"
                goal={bodyFatGoal}
                xDomain={sharedXDomain}
              />
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
