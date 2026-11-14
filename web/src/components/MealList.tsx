import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { OTHER_MEAL, formatAmount, formatMacro, type MealGroup } from '@gainz/shared/macros'
import type { Meal } from '@gainz/shared/types'

const summary = ({ calories, proteinG, fatG, carbsG }: MealGroup['totals']) =>
  [`${Math.round(calories)} cal`, `${Math.round(proteinG)}g P`, `${Math.round(fatG)}g F`, `${Math.round(carbsG)}g C`].join(' · ')

// Today's foods grouped by meal (see groupByMeal). Each real meal offers its own
// "Add"; "Other" holds foods with no matching meal, so it has none.
// Clicking a food opens it in Log food to change its amount, values or meal, or
// delete it (that's also how touch screens and keyboards move a food: native
// HTML drag and drop doesn't fire on touch). With a mouse, foods can also be
// dragged between meals.
function MealList({
  groups,
  onAdd,
  onMove,
  onEdit,
}: {
  groups: MealGroup[]
  onAdd: (mealName: string) => void
  onMove: (id: string, mealName: string) => void
  onEdit: (meal: Meal) => void
}) {
  const [dragging, setDragging] = useState<{ id: string; from: string } | null>(null)
  const [over, setOver] = useState<string | null>(null) // meal name under the pointer

  const drop = (target: string) => {
    if (dragging && dragging.from !== target) onMove(dragging.id, target)
    setDragging(null)
    setOver(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section
          key={group.name}
          onDragOver={(e) => {
            if (!dragging) return
            e.preventDefault() // marks this section as a valid drop target
            if (over !== group.name) setOver(group.name)
          }}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOver(null)}
          onDrop={(e) => {
            e.preventDefault()
            drop(group.name)
          }}
          className={`-m-1 rounded-xl p-1 transition ${
            over === group.name && dragging?.from !== group.name ? 'bg-third/10 ring-1 ring-third/40' : ''
          }`}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold text-third">{group.name}</h3>
            <div className="flex items-baseline gap-3 text-xs text-third/60">
              {group.entries.length > 0 && (
                <span className="text-third">
                  <span className="text-third/60">Total </span>
                  {summary(group.totals)}
                </span>
              )}
              {group.name !== OTHER_MEAL && (
                <button
                  type="button"
                  onClick={() => onAdd(group.name)}
                  aria-label={`Add food to ${group.name}`}
                  className="font-medium transition hover:text-third"
                >
                  + Add
                </button>
              )}
            </div>
          </div>

          {group.entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-secondary/25 px-3 py-2 text-xs text-third/40">
              Nothing logged
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {group.entries.map((meal) => {
                const details = [
                  meal.amount != null && meal.unit ? formatAmount(meal.amount, meal.unit) : null,
                  `${meal.calories} cal`,
                  formatMacro(meal.proteinG, 'g P'),
                  formatMacro(meal.fatG, 'g F'),
                  formatMacro(meal.carbsG, 'g C'),
                ].filter(Boolean)

                return (
                  <li
                    key={meal.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', meal.id) // Firefox won't start a drag without data
                      setDragging({ id: meal.id, from: group.name })
                    }}
                    onDragEnd={() => {
                      setDragging(null)
                      setOver(null)
                    }}
                    className={dragging?.id === meal.id ? 'opacity-50' : ''}
                  >
                    <button
                      type="button"
                      onClick={() => onEdit(meal)}
                      aria-label={`${meal.description}, ${meal.calories} calories. Edit`}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-secondary/25 px-3 py-2 text-left text-sm transition hover:border-secondary/60"
                    >
                      <span>
                        <span className="block text-third">{meal.description}</span>
                        <span className="block text-xs text-third/60">{details.join(' · ')}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-third/40" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

export default MealList
