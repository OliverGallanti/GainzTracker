import { BIG_FOUR_LIFTS } from '../lib/lifts'
import { getStrengthReferenceLines, getStrengthTier } from '../lib/strength'
import { StatLineChart } from './StatLineChart'

// `selectedLift` and `showStandards` are controlled by the card, NOT held here:
// this panel unmounts whenever a form is open, so state kept here would reset
// to Deadlift / checked every time the user logs a lift or edits a goal.
function BigFourProgress({
  sets,
  goals,
  bodyweight,
  sex,
  selectedLift,
  onSelectLift,
  showStandards,
  onShowStandardsChange,
  onEditGoals,
}) {
  const liftEntries = sets
    .filter((s) => s.exerciseName === selectedLift)
    .slice()
    .reverse() // sets are newest-first; the chart wants oldest-first
  const selectedGoal = goals?.[selectedLift]
  const selectedTier = getStrengthTier(selectedLift, liftEntries.at(-1)?.weightKg, bodyweight, sex)
  const selectedTierLines = getStrengthReferenceLines(selectedLift, bodyweight, sex)

  return (
    <div className="mt-5 border-t border-secondary/25 pt-4">
      <div className="mb-3 flex flex-wrap gap-1">
        {BIG_FOUR_LIFTS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelectLift(name)}
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
            onClick={onEditGoals}
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
                onChange={(e) => onShowStandardsChange(e.target.checked)}
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
  )
}

export default BigFourProgress
