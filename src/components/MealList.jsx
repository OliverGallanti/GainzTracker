import { useState } from 'react'
import { OTHER_MEAL, formatMacro } from '../lib/macros'

const summary = ({ calories, proteinG, fatG, carbsG }) =>
  [`${Math.round(calories)} cal`, `${Math.round(proteinG)}g P`, `${Math.round(fatG)}g F`, `${Math.round(carbsG)}g C`].join(' · ')

// Today's foods grouped by meal (see groupByMeal). Each real meal offers its own
// "Add"; "Other" holds foods with no matching meal, so it has none.
// Foods move between meals by drag and drop (mouse), or with the "Move to"
// select on each food, which is what touch screens and keyboards use: native
// HTML drag and drop doesn't fire on touch.
function MealList({ groups, onAdd, onMove, onRemove }) {
  const [dragging, setDragging] = useState(null) // { id, from }
  const [over, setOver] = useState(null) // meal name under the pointer

  const drop = (target) => {
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
          onDragLeave={(e) => !e.currentTarget.contains(/** @type {Node | null} */ (e.relatedTarget)) && setOver(null)}
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
                const macros = [
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
                    className={`flex cursor-grab items-center justify-between gap-2 rounded-lg border border-secondary/25 px-3 py-2 text-sm active:cursor-grabbing ${
                      dragging?.id === meal.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div>
                      <p className="text-third">{meal.description}</p>
                      <p className="text-xs text-third/60">
                        {meal.calories} cal{macros.length > 0 ? ` · ${macros.join(' · ')}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <select
                        value={group.name}
                        onChange={(e) => onMove(meal.id, e.target.value)}
                        aria-label={`Move ${meal.description} to another meal`}
                        className="max-w-24 rounded-md border border-secondary/40 bg-main px-1 py-0.5 text-xs text-third/80 outline-none focus:border-secondary"
                      >
                        {groups.map((g) => (
                          <option key={g.name} value={g.name}>
                            {g.name}
                          </option>
                        ))}
                        {!groups.some((g) => g.name === OTHER_MEAL) && <option value={OTHER_MEAL}>{OTHER_MEAL}</option>}
                      </select>
                      <button
                        type="button"
                        onClick={() => onRemove(meal.id)}
                        className="text-xs font-medium text-third/60 transition hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
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
