import { OTHER_MEAL, formatMacro } from '../lib/macros'

const summary = ({ calories, proteinG, fatG, carbsG }) =>
  [`${Math.round(calories)} cal`, `${Math.round(proteinG)}P`, `${Math.round(fatG)}F`, `${Math.round(carbsG)}C`].join(' · ')

// Today's foods grouped by meal (see groupByMeal). Each real meal offers its own
// "Add"; "Other" holds foods with no matching meal, so it has none.
function MealList({ groups, onAdd, onRemove }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.name}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold text-third">{group.name}</h3>
            <div className="flex items-baseline gap-3 text-xs text-third/60">
              {group.entries.length > 0 && <span>{summary(group.totals)}</span>}
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
                    className="flex items-center justify-between rounded-lg border border-secondary/25 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="text-third">{meal.description}</p>
                      <p className="text-xs text-third/60">
                        {meal.calories} cal{macros.length > 0 ? ` · ${macros.join(' · ')}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(meal.id)}
                      className="text-xs font-medium text-third/60 transition hover:text-red-400"
                    >
                      Remove
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
