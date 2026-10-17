import { useState } from 'react'
import type { WorkoutSet } from '../lib/types'
import { Dumbbell } from 'lucide-react'
import { api } from '../lib/api'
import { BIG_FOUR_LIFTS } from '../lib/lifts'
import { useMe, useWeights } from '../lib/sharedData'
import { getStrengthTier } from '../lib/strength'
import { useLoad } from '../lib/useLoad'
import BigFourProgress from './BigFourProgress'
import BigFourLogList from './BigFourLogList'
import BigFourLiftForm from './BigFourLiftForm'
import BigFourGoalsForm from './BigFourGoalsForm'

const HELP_TEXT =
  'Ranked by your most recent lift, not your all-time best. The icon is your strength level ' +
  '(Beginner → Elite) - your lift as a multiple of your latest logged bodyweight, against standard ' +
  "ratios for your sex. The chart's faint lines mark the Novice/Intermediate/Advanced/Elite " +
  'weights for you specifically, so you can see what to aim for next.'

// Reuses the existing (previously frontend-less) /api/workout-sets — a plain
// exerciseName + weightKg + reps log, exactly the shape this needs.
function BigFourCard() {
  const [mode, setMode] = useState('view') // 'view' | 'log' | 'editGoals'
  const [showHelp, setShowHelp] = useState(false)

  // Display state for the panels below. Held here rather than in the panels
  // because they unmount whenever a form is open, which would reset the
  // selection every time the user logs a lift or edits a goal.
  const [selectedLift, setSelectedLift] = useState<string>(BIG_FOUR_LIFTS[0])
  const [showStandards, setShowStandards] = useState(true)
  const [logsExpanded, setLogsExpanded] = useState(true) // the side panel has room; the list scrolls

  const lifts = useLoad(() => api<WorkoutSet[]>('/api/workout-sets'))
  const goalsResource = useLoad(() => api<Record<string, number>>('/api/lift-goals')) // { [liftName]: kg }
  const me = useMe()
  const weights = useWeights()

  const sets = lifts.data ?? null
  const goals = goalsResource.data // undefined while loading; {} once loaded with none set
  const sex = me.data ? me.data.sex ?? null : undefined // null = unset, undefined = loading
  // Already sorted loggedAt desc by the API, so [0] is the latest weigh-in.
  const bodyweight = weights.data ? (weights.data.length ? weights.data[0].weightKg : null) : undefined

  const loadError = lifts.error || goalsResource.error || me.error || weights.error
  const retry = () => {
    lifts.reload()
    goalsResource.reload()
    me.reload()
    weights.reload()
  }

  // Each write invalidates only the resource it changed.
  const handleLiftSaved = () => {
    setMode('view')
    lifts.reload()
  }
  const handleGoalsSaved = () => {
    setMode('view')
    goalsResource.reload()
  }

  const handleRemove = async (id: string) => {
    await api(`/api/workout-sets/${id}`, { method: 'DELETE' })
    lifts.reload()
  }

  const isLoading =
    sets === null || goals === undefined || sex === undefined || bodyweight === undefined

  // The API already returns sets newest-first, so the first match per lift
  // is its most recent entry — the "current" number the ranking and the
  // strength-tier rating are both built on, not the all-time best.
  const latestByLift = BIG_FOUR_LIFTS.map((name) => {
    const entry = sets?.find((s) => s.exerciseName === name) ?? null
    return { name, entry, tier: getStrengthTier(name, entry?.weightKg, bodyweight, sex) }
  })
  const ranked = [...latestByLift].sort((a, b) => (b.entry?.weightKg ?? -1) - (a.entry?.weightKg ?? -1))
  const loggedEntries = sets?.filter((s) => BIG_FOUR_LIFTS.includes(s.exerciseName)) ?? []

  return (
    <div className="glow-card col-span-full w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-1.5">
          <h2 className="card-title">Big 4</h2>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            aria-label="What does this card show?"
            className="flex h-4 w-4 items-center justify-center rounded-full border border-secondary/40 text-[10px] font-semibold text-third/60 transition hover:border-secondary hover:text-third"
          >
            ?
          </button>
        </div>
        {mode === 'view' && (
          <button
            type="button"
            onClick={() => setMode('log')}
            className="btn btn-secondary"
          >
            <Dumbbell size={14} />
            Log lift
          </button>
        )}
      </div>

      {showHelp && (
        <p className="mb-4 rounded-lg border border-secondary/25 bg-main/40 px-3 py-2 text-xs text-third/60">
          {HELP_TEXT}
        </p>
      )}

      {isLoading && !loadError && <p className="text-xs text-third/60">Loading…</p>}

      {loadError && (
        <p className="text-xs text-red-400">
          Could not load your Big 4 data:{' '}
          <button type="button" onClick={retry} className="underline hover:no-underline">
            retry
          </button>
        </p>
      )}

      {!isLoading && mode === 'view' && (
        <>
          {/* The ranking doubles as the lift picker for the chart below. */}
          <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ranked.map(({ name, entry, tier }, i) => (
              <li key={name} className="flex">
                <button
                  type="button"
                  onClick={() => setSelectedLift(name)}
                  aria-pressed={selectedLift === name}
                  className={`flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition ${
                    selectedLift === name
                      ? 'border-third/70 bg-third/10'
                      : 'border-secondary/25 hover:border-secondary'
                  }`}
                >
                  <span className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${entry ? 'text-third' : 'text-third/40'}`}>
                      {entry ? `#${i + 1}` : '—'}
                    </span>
                    {tier && <span title={tier.label}>{tier.icon}</span>}
                  </span>
                  <span className={`text-sm ${entry ? 'text-third' : 'text-third/60'}`}>{name}</span>
                  <span className={entry ? 'text-lg font-semibold text-third' : 'text-xs text-third/60'}>
                    {entry ? `${entry.weightKg}kg${entry.reps ? ` × ${entry.reps}` : ''}` : 'Not logged yet'}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          {sex === null && sets?.length > 0 && (
            <p className="mt-2 text-xs text-third/60">
              Set your sex in Profile &amp; security to see strength-level ratings.
            </p>
          )}

          <div className="mt-5 grid gap-x-8 gap-y-5 border-t border-secondary/25 pt-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BigFourProgress
                sets={sets}
                goals={goals}
                bodyweight={bodyweight}
                sex={sex}
                selectedLift={selectedLift}
                showStandards={showStandards}
                onShowStandardsChange={setShowStandards}
                onEditGoals={() => setMode('editGoals')}
              />
            </div>

            <BigFourLogList
              entries={loggedEntries}
              expanded={logsExpanded}
              onToggle={() => setLogsExpanded((v) => !v)}
              onRemove={handleRemove}
            />
          </div>
        </>
      )}

      {mode === 'log' && <BigFourLiftForm onSaved={handleLiftSaved} onCancel={() => setMode('view')} />}

      {mode === 'editGoals' && (
        <BigFourGoalsForm
          goals={goals}
          onSaved={handleGoalsSaved}
          onCancel={() => setMode('view')}
        />
      )}
    </div>
  )
}

export default BigFourCard
