import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { BIG_FOUR_LIFTS } from '../lib/lifts'
import { getStrengthTier } from '../lib/strength'
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
  const [sets, setSets] = useState(null)
  const [sex, setSex] = useState(undefined) // undefined = loading, null = unset
  const [meGoals, setMeGoals] = useState(undefined)
  const [bodyweight, setBodyweight] = useState(undefined) // undefined = loading, null = no weight logged

  const [mode, setMode] = useState('view') // 'view' | 'log' | 'editGoals'
  const [showHelp, setShowHelp] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const load = async () => {
    try {
      const [fetchedSets, me, weights] = await Promise.all([
        api('/api/workout-sets'),
        api('/api/me'),
        api('/api/weights'),
      ])
      setLoadError(false)
      setSets(fetchedSets)
      setSex(me.sex ?? null)
      setMeGoals({
        deadliftGoalKg: me.deadliftGoalKg,
        squatGoalKg: me.squatGoalKg,
        benchPressGoalKg: me.benchPressGoalKg,
        overheadPressGoalKg: me.overheadPressGoalKg,
      })
      // Already sorted loggedAt desc by the API, so [0] is the latest weigh-in.
      setBodyweight(weights.length ? weights[0].weightKg : null)
    } catch {
      setLoadError(true)
    }
  }

  // See MacroStatsCard — same fetch-on-mount pattern, same pending hook.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  const handleSaved = () => {
    setMode('view')
    load()
  }

  const handleRemove = async (id) => {
    await api(`/api/workout-sets/${id}`, { method: 'DELETE' })
    load()
  }

  const isLoading = sets === null || sex === undefined || meGoals === undefined || bodyweight === undefined

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
    <div className="w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-third">Big 4</h2>
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
            className="text-xs font-medium text-third/60 transition hover:text-third"
          >
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
          Could not load your Big 4 data —{' '}
          <button type="button" onClick={load} className="underline hover:no-underline">
            retry
          </button>
        </p>
      )}

      {!isLoading && mode === 'view' && (
        <>
          <ol className="flex flex-col gap-2">
            {ranked.map(({ name, entry, tier }, i) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-lg border border-secondary/25 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold ${entry ? 'text-third' : 'text-third/40'}`}>
                    {entry ? `#${i + 1}` : '—'}
                  </span>
                  <span className={entry ? 'text-third' : 'text-third/60'}>{name}</span>
                  {tier && <span title={tier.label}>{tier.icon}</span>}
                </div>
                <span className={entry ? 'font-medium text-third' : 'text-xs text-third/60'}>
                  {entry ? `${entry.weightKg}kg${entry.reps ? ` × ${entry.reps}` : ''}` : 'Not logged yet'}
                </span>
              </li>
            ))}
          </ol>

          {sex === null && sets?.length > 0 && (
            <p className="mt-2 text-xs text-third/60">
              Set your sex in Profile &amp; security to see strength-level ratings.
            </p>
          )}

          <BigFourProgress
            sets={sets}
            meGoals={meGoals}
            bodyweight={bodyweight}
            sex={sex}
            onEditGoals={() => setMode('editGoals')}
          />

          <BigFourLogList entries={loggedEntries} onRemove={handleRemove} />
        </>
      )}

      {mode === 'log' && <BigFourLiftForm onSaved={handleSaved} onCancel={() => setMode('view')} />}

      {mode === 'editGoals' && (
        <BigFourGoalsForm
          meGoals={meGoals}
          onSaved={handleSaved}
          onCancel={() => setMode('view')}
        />
      )}
    </div>
  )
}

export default BigFourCard
