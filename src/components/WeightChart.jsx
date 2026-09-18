import { useState } from 'react'
import { computeBmi } from '../lib/body'
import { useMe, useWeights } from '../lib/sharedData'
import WeightCharts from './WeightCharts'
import WeightForm from './WeightForm'
import HeightForm from './HeightForm'
import WeightGoalsForm from './WeightGoalsForm'

function WeightChart() {
  const [mode, setMode] = useState('view') // 'view' | 'logWeight' | 'editHeight' | 'editGoals'

  const me = useMe()
  const weights = useWeights()

  // The API returns newest-first; the charts and "latest" lookups want oldest-first.
  const entries = weights.data
    ? [...weights.data].sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt))
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
  const handleProfileSaved = () => {
    setMode('view')
    me.reload()
  }

  const isLoading = entries === null || me.data === undefined
  const isEmpty = entries?.length === 0
  const latestEntry = entries?.length ? entries[entries.length - 1] : null
  const latestBodyFat = entries ? [...entries].reverse().find((e) => e.bodyFatPercent != null) : null
  const bmi = latestEntry ? computeBmi(latestEntry.weightKg, height) : null

  return (
    <div className="w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-third">Weight</h2>
        {mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('logWeight')}
            className="text-xs font-medium text-third/60 transition hover:text-third"
          >
            Log weight
          </button>
        )}
      </div>

      {isLoading && !loadError && <p className="text-xs text-third/60">Loading…</p>}

      {loadError && (
        <p className="text-xs text-red-400">
          Could not load your weight data —{' '}
          <button type="button" onClick={retry} className="underline hover:no-underline">
            retry
          </button>
        </p>
      )}

      {!isLoading && mode === 'view' && (
        <div className="mb-4 flex flex-col gap-1 text-xs">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <div>
              <span className="text-third/60">Height </span>
              <button
                type="button"
                onClick={() => setMode('editHeight')}
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
              onClick={() => setMode('editGoals')}
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
        <WeightCharts entries={entries} weightGoal={weightGoal} bodyFatGoal={bodyFatGoal} />
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
