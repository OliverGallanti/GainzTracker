import { Pencil, Plus } from 'lucide-react'
import type { Sex, WorkoutSet } from '../lib/types'
import { getStrengthReferenceLines, getStrengthTier } from '../lib/strength'
import { StatLineChart } from './StatLineChart'

// `selectedLift` (picked via the card's lift tiles) and `showStandards` are
// controlled by the card, NOT held here: this panel unmounts whenever a form is
// open, so state kept here would reset every time the user logs a lift or edits a goal.
function BigFourProgress({
  sets,
  goals,
  bodyweight,
  sex,
  selectedLift,
  showStandards,
  onShowStandardsChange,
  onEditGoals,
}: {
  sets: WorkoutSet[]
  goals: Record<string, number> | undefined
  bodyweight: number | null
  sex: Sex | null
  selectedLift: string
  showStandards: boolean
  onShowStandardsChange: (show: boolean) => void
  onEditGoals: () => void
}) {
  const liftEntries = sets
    .filter((s) => s.exerciseName === selectedLift)
    .slice()
    .reverse() // sets are newest-first; the chart wants oldest-first
  const selectedGoal = goals?.[selectedLift]
  const selectedTier = getStrengthTier(selectedLift, liftEntries.at(-1)?.weightKg, bodyweight, sex)
  const selectedTierLines = getStrengthReferenceLines(selectedLift, bodyweight, sex)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-third/60">
          Goal: {selectedGoal ? `${selectedGoal}kg` : 'Not set'}
          <button type="button" onClick={onEditGoals} className="btn btn-secondary">
            {selectedGoal ? <Pencil size={14} /> : <Plus size={14} />}
            {selectedGoal ? 'Edit goal' : 'Set goal'}
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
