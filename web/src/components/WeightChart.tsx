import { useState } from 'react'
import { Flag, Ruler, Scale } from 'lucide-react'
import { computeBmi } from '@gainz/shared/body'
import { dayLabel, startOfLocalDay } from '@gainz/shared/dates'
import type { WeightEntry } from '@gainz/shared/types'
import { api } from '../lib/api'
import { useMe, useWeights } from '../lib/sharedData'
import { useSubmit } from '../lib/useSubmit'
import MonthGrid from './MonthGrid'
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
  // The calendar's day (null = today) and the weigh-in being edited, if any.
  const [picked, setPicked] = useState<Date | null>(null)
  const [editing, setEditing] = useState<WeightEntry | undefined>()
  const day = picked ?? startOfLocalDay()

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
    setEditing(undefined)
    weights.reload()
  }
  const { submit: removeEntry, error: removeError } = useSubmit(async (id: string) => {
    await api(`/api/weights/${id}`, { method: 'DELETE' })
    weights.reload()
  }, 'Could not remove that weigh-in: please try again')
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
  const loggedDays = new Set(entries?.map((e) => new Date(e.loggedAt).toDateString()))
  const onDay = (entries ?? []).filter((e) => new Date(e.loggedAt).toDateString() === day.toDateString())

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
            {picked ? `Log weight on ${dayLabel(day)}` : 'Log weight'}
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

      {!isLoading && mode === 'view' && !isEmpty && (
        <div className="mt-5 border-t border-secondary/25 pt-4">
          <MonthGrid
            mark={(date) => (loggedDays.has(date.toDateString()) ? { filled: true, note: 'weighed in' } : undefined)}
            selected={day}
            onSelect={setPicked}
          />
          <p className="mt-3 text-sm font-medium text-third">{dayLabel(day)}</p>
          {onDay.length === 0 && <p className="mt-1 text-xs text-third/60">No weigh-in on this day.</p>}
          {onDay.map((entry) => (
            <div key={entry.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-third">
                {entry.weightKg} kg{entry.bodyFatPercent != null ? ` · ${entry.bodyFatPercent}%` : ''}
              </span>
              <span className="flex gap-3 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(entry)
                    setMode('logWeight')
                  }}
                  className="text-third/60 transition hover:text-third"
                >
                  Edit
                </button>
                <button type="button" onClick={() => removeEntry(entry.id)} className="text-third/60 transition hover:text-red-400">
                  Remove
                </button>
              </span>
            </div>
          ))}
          {removeError && <p className="mt-2 text-xs text-red-400">{removeError}</p>}
        </div>
      )}

      {mode === 'logWeight' && (
        <WeightForm
          day={day}
          editing={editing}
          onSaved={handleWeightSaved}
          onCancel={() => {
            setMode('view')
            setEditing(undefined)
          }}
        />
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
