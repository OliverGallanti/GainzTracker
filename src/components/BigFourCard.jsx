import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { getStrengthReferenceLines, getStrengthTier } from '../lib/strength'
import { StatLineChart } from './StatLineChart'

const HELP_TEXT =
  "Ranked by your most recent lift, not your all-time best. The icon is your strength level " +
  '(Beginner → Elite) - your lift as a multiple of your latest logged bodyweight, against standard ' +
  "ratios for your sex. The chart's faint lines mark the Novice/Intermediate/Advanced/Elite " +
  'weights for you specifically, so you can see what to aim for next.'

const BIG_FOUR_LIFTS = ['Deadlift', 'Squat', 'Bench Press', 'Overhead Press']

const GOAL_FIELD = {
  Deadlift: 'deadliftGoalKg',
  Squat: 'squatGoalKg',
  'Bench Press': 'benchPressGoalKg',
  'Overhead Press': 'overheadPressGoalKg',
}

const emptyForm = { exerciseName: BIG_FOUR_LIFTS[0], weightKg: '', reps: '' }
const emptyGoalsForm = { deadliftGoalKg: '', squatGoalKg: '', benchPressGoalKg: '', overheadPressGoalKg: '' }

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Reuses the existing (previously frontend-less) /api/workout-sets — a plain
// exerciseName + weightKg + reps log, exactly the shape this needs. No new
// backend route or model for the lifts themselves; only `sex` and the four
// per-lift goal fields were new (see server/README.md).
function BigFourCard() {
  const [sets, setSets] = useState(null)
  const [sex, setSex] = useState(undefined) // undefined = loading, null = unset
  const [meGoals, setMeGoals] = useState(undefined)
  const [bodyweight, setBodyweight] = useState(undefined) // undefined = loading, null = no weight logged

  const [mode, setMode] = useState('view') // 'view' | 'log' | 'editGoals'
  const [selectedLift, setSelectedLift] = useState(BIG_FOUR_LIFTS[0])
  const [showHelp, setShowHelp] = useState(false)
  const [logsExpanded, setLogsExpanded] = useState(false)
  const [showStandards, setShowStandards] = useState(true)

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [goalsForm, setGoalsForm] = useState(emptyGoalsForm)
  const [savingGoals, setSavingGoals] = useState(false)
  const [goalsError, setGoalsError] = useState(null)

  const load = () => {
    api('/api/workout-sets').then(setSets)
    api('/api/me').then((me) => {
      setSex(me.sex ?? null)
      setMeGoals({
        deadliftGoalKg: me.deadliftGoalKg,
        squatGoalKg: me.squatGoalKg,
        benchPressGoalKg: me.benchPressGoalKg,
        overheadPressGoalKg: me.overheadPressGoalKg,
      })
    })
    // Already sorted loggedAt desc by the API, so [0] is the latest weigh-in.
    api('/api/weights').then((data) => setBodyweight(data.length ? data[0].weightKg : null))
  }

  useEffect(() => {
    load()
  }, [])

  const startLog = () => {
    setForm(emptyForm)
    setError(null)
    setMode('log')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api('/api/workout-sets', {
        method: 'POST',
        body: JSON.stringify({
          exerciseName: form.exerciseName,
          weightKg: Number(form.weightKg),
          ...(form.reps ? { reps: Number(form.reps) } : {}),
        }),
      })
      setMode('view')
      load()
    } catch {
      setError('Could not log that lift — please check the values and try again')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id) => {
    await api(`/api/workout-sets/${id}`, { method: 'DELETE' })
    load()
  }

  const startEditGoals = () => {
    setGoalsForm({
      deadliftGoalKg: meGoals?.deadliftGoalKg ?? '',
      squatGoalKg: meGoals?.squatGoalKg ?? '',
      benchPressGoalKg: meGoals?.benchPressGoalKg ?? '',
      overheadPressGoalKg: meGoals?.overheadPressGoalKg ?? '',
    })
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
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(goalsForm)
              .filter(([, v]) => v)
              .map(([k, v]) => [k, Number(v)]),
          ),
        ),
      })
      setMode('view')
      load()
    } catch {
      setGoalsError('Could not save your goals — please check the values and try again')
    } finally {
      setSavingGoals(false)
    }
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
  // Collapsed by default (see logsExpanded), so no need to cap this list —
  // it's the full history, not just a recent few.
  const recentEntries = sets?.filter((s) => BIG_FOUR_LIFTS.includes(s.exerciseName)) ?? []

  const liftEntries = (sets ?? [])
    .filter((s) => s.exerciseName === selectedLift)
    .slice()
    .reverse() // sets are newest-first; the chart wants oldest-first
  const selectedGoal = meGoals?.[GOAL_FIELD[selectedLift]]
  const selectedTier = getStrengthTier(selectedLift, liftEntries.at(-1)?.weightKg, bodyweight, sex)
  const selectedTierLines = getStrengthReferenceLines(selectedLift, bodyweight, sex)

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
            onClick={startLog}
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

      {isLoading && <p className="text-xs text-third/60">Loading…</p>}

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

          <div className="mt-5 border-t border-secondary/25 pt-4">
            <div className="mb-3 flex flex-wrap gap-1">
              {BIG_FOUR_LIFTS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedLift(name)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    selectedLift === name ? 'bg-third text-main' : 'text-third/60 hover:text-third'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-third/60">
                Goal: {selectedGoal ? `${selectedGoal}kg` : 'Not set'}{' '}
                <button
                  type="button"
                  onClick={startEditGoals}
                  className="text-third underline decoration-secondary/40 underline-offset-2 hover:decoration-secondary"
                >
                  {selectedGoal ? 'Edit' : 'Set'}
                </button>
              </span>
              {selectedTier && (
                <span className="text-third">
                  {selectedTier.icon} {selectedTier.label}
                </span>
              )}
            </div>

            {liftEntries.length === 0 ? (
              <p className="text-xs text-third/60">No {selectedLift} entries logged yet.</p>
            ) : (
              <>
                {selectedTierLines.length > 0 && (
                  <label className="mb-2 flex items-center gap-1.5 text-xs text-third/60">
                    <input
                      type="checkbox"
                      checked={showStandards}
                      onChange={(e) => setShowStandards(e.target.checked)}
                      className="accent-third"
                    />
                    Show strength-standard lines
                  </label>
                )}
                <StatLineChart
                  data={liftEntries.map((e) => ({ loggedAt: e.performedAt, value: e.weightKg }))}
                  unit="kg"
                  goal={selectedGoal}
                  referenceLines={showStandards ? selectedTierLines : []}
                />
              </>
            )}
          </div>

          {recentEntries.length > 0 && (
            <div className="mt-5 border-t border-secondary/25 pt-4">
              <button
                type="button"
                onClick={() => setLogsExpanded((v) => !v)}
                aria-expanded={logsExpanded}
                className="flex w-full items-center justify-between text-xs font-medium text-third/60 transition hover:text-third"
              >
                <span>Recent logs ({recentEntries.length})</span>
                <span>{logsExpanded ? '▲ Hide' : '▼ Show'}</span>
              </button>

              {logsExpanded && (
                <ul className="mt-3 flex flex-col gap-2">
                  {recentEntries.map((s) => (
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
                        onClick={() => handleRemove(s.id)}
                        className="text-xs font-medium text-third/60 transition hover:text-red-400"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {mode === 'log' && (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-third">Lift</span>
            <select
              value={form.exerciseName}
              onChange={(e) => setForm({ ...form, exerciseName: e.target.value })}
              className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
            >
              {BIG_FOUR_LIFTS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-third">Weight (kg)</span>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
              className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-third">Reps (optional)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.reps}
              onChange={(e) => setForm({ ...form, reps: e.target.value })}
              className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
            />
          </label>

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </form>
      )}

      {mode === 'editGoals' && (
        <form onSubmit={handleSaveGoals} className="flex flex-col gap-3">
          {BIG_FOUR_LIFTS.map((name) => (
            <label key={name} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-third">{name} goal (kg)</span>
              <input
                type="number"
                min="1"
                step="any"
                value={goalsForm[GOAL_FIELD[name]]}
                onChange={(e) => setGoalsForm({ ...goalsForm, [GOAL_FIELD[name]]: e.target.value })}
                className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
              />
            </label>
          ))}

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

export default BigFourCard
