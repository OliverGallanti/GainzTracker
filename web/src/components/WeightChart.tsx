import { useState } from 'react'
import { Flag, Ruler, Scale } from 'lucide-react'
import { computeBmi } from '@gainz/shared/body'
import { useMe, useWeights } from '../lib/sharedData'
import WeightCharts from './WeightCharts'
import WeightForm from './WeightForm'
import HeightForm from './HeightForm'
import MeasurementsForm from './MeasurementsForm'
import WeightGoalsForm from './WeightGoalsForm'

function WeightChart() {
  const [mode, setMode] = useState('view') // 'view' | 'logWeight' | 'editHeight' | 'editGoals'

  // Held here, not in <WeightCharts>: that panel unmounts while a form is open,
  // which would reset the user's chosen window every time they log a weight.
  const [chartMode, setChartMode] = useState('weight') // 'weight' | 'bodyFat' | 'both'
  const [range, setRange] = useState('1y')

  const me = useMe()
  const weights = useWeights()

  // The API returns newest-first; the charts and "latest" lookups want oldest-first.
  const entries = weights.data
    ? [...weights.data].sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt))
    : null
  const height = me.data?.heightCm // null = unset
  const weightGoal = me.data?.weightGoalKg
  const bodyFatGoal = me.data?.bodyFatGoalPercent

  const loadError = weights.error || me.error
  const retry = () => {
    weights.reload()
    me.reload()
  }

  // Each form knows which of the two shared resources its write invalidates.
  const handleWeightSaved = () => {
    setMode('view')
    weights.reload()
  }
  const handleMeasurementsSaved = () => {
    weights.reload()
    me.reload()
  }
  const handleProfileSaved = () => {
    setMode('view')
    me.reload()
  }

  const isLoading = entries === null || me.data === undefined
  const isEmpty = entries?.length === 0
  const hasGoals = Boolean(weightGoal || bodyFatGoal)
  const latestEntry = entries?.length ? entries[entries.length - 1] : null
  const latestBodyFat = entries ? [...entries].reverse().find((e) => e.bodyFatPercent != null) : null
  const bmi = latestEntry ? computeBmi(latestEntry.weightKg, height) : null

  return (
    <div id="weight-card" className="glow-card w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="card-title">Weight</h2>
        {mode === 'view' && !isEmpty && (
          <button
            type="button"
            onClick={() => setMode('logWeight')}
            className="btn btn-secondary"
          >
            <Scale size={14} />
            Log weight
          </button>
        )}
      </div>

      {isLoading && !loadError && <p className="text-xs text-third/60">Loading…</p>}

      {loadError && (
        <p className="text-xs text-red-400">
          Could not load your weight data:{' '}
          <button type="button" onClick={retry} className="underline hover:no-underline">
            retry
          </button>
        </p>
      )}

      {!isLoading && mode === 'view' && !isEmpty && (
        <div className="mb-4 flex flex-col gap-3 text-xs">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('editHeight')}
              aria-label={height ? `Edit height, currently ${height} cm` : 'Set height'}
              className="btn btn-secondary"
            >
              <Ruler size={14} />
              {height ? `${height} cm` : 'Set height'}
            </button>
            <button
              type="button"
              onClick={() => setMode('editGoals')}
              aria-label={hasGoals ? 'Edit goals' : 'Set goals'}
              className="btn btn-secondary"
            >
              <Flag size={14} />
              {hasGoals ? (
                <span>
                  Goal:{' '}
                  {weightGoal ? `${weightGoal}kg` : null}
                  {weightGoal && bodyFatGoal ? ' · ' : null}
                  {bodyFatGoal ? `${bodyFatGoal}% BF` : null}
                </span>
              ) : (
                'Set goals'
              )}
            </button>
          </div>

          {(latestBodyFat || bmi != null) && (
            <div className="flex flex-wrap gap-x-5 gap-y-1">
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
          )}
        </div>
      )}

      {!isLoading && mode === 'view' && isEmpty && (
        <MeasurementsForm
          height={height}
          weightGoal={weightGoal}
          bodyFatGoal={bodyFatGoal}
          onSaved={handleMeasurementsSaved}
        />
      )}

      {!isLoading && mode === 'view' && !isEmpty && (
        <WeightCharts
          entries={entries}
          weightGoal={weightGoal}
          bodyFatGoal={bodyFatGoal}
          chartMode={chartMode}
          onChartModeChange={setChartMode}
          range={range}
          onRangeChange={setRange}
        />
      )}

      {mode === 'logWeight' && (
        <WeightForm onSaved={handleWeightSaved} onCancel={() => setMode('view')} />
      )}

      {mode === 'editHeight' && (
        <HeightForm height={height} onSaved={handleProfileSaved} onCancel={() => setMode('view')} />
      )}

      {mode === 'editGoals' && (
        <WeightGoalsForm
          weightGoal={weightGoal}
          bodyFatGoal={bodyFatGoal}
          onSaved={handleProfileSaved}
          onCancel={() => setMode('view')}
        />
      )}
    </div>
  )
}

export default WeightChart
