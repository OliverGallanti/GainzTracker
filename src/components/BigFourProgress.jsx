import { useState } from 'react'
import { BIG_FOUR_LIFTS, GOAL_FIELD } from '../lib/lifts'
import { getStrengthReferenceLines, getStrengthTier } from '../lib/strength'
import { StatLineChart } from './StatLineChart'

// Which lift is selected and whether the standard lines show are display-only
// concerns, so they stay here rather than in the card.
function BigFourProgress({ sets, meGoals, bodyweight, sex, onEditGoals }) {
  const [selectedLift, setSelectedLift] = useState(BIG_FOUR_LIFTS[0])
  const [showStandards, setShowStandards] = useState(true)

  const liftEntries = sets
    .filter((s) => s.exerciseName === selectedLift)
    .slice()
    .reverse() // sets are newest-first; the chart wants oldest-first
  const selectedGoal = meGoals?.[GOAL_FIELD[selectedLift]]
  const selectedTier = getStrengthTier(selectedLift, liftEntries.at(-1)?.weightKg, bodyweight, sex)
  const selectedTierLines = getStrengthReferenceLines(selectedLift, bodyweight, sex)

  return (
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
  )
}

export default BigFourProgress
