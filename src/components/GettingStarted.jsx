import { onboardingSteps } from '../lib/onboarding'
import { useMe, useWeights } from '../lib/sharedData'

const scrollToWeightCard = () =>
  document.getElementById('weight-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

// Shown to new users only, above the macros card: the calorie estimate there needs
// a profile, a height and a weight, which live elsewhere. It computes its own
// visibility from the data, so once the basics exist it just stops rendering,
// and it stays quiet while loading or if a load failed.
function GettingStarted({ onOpenProfile }) {
  const me = useMe()
  const weights = useWeights()

  if (!me.data || !weights.data) return null

  const steps = onboardingSteps(me.data, weights.data)
  if (steps.every((step) => step.done)) return null

  const actions = { profile: onOpenProfile, body: scrollToWeightCard }
  const actionLabels = { profile: 'Open profile', body: 'Go to weight' }

  return (
    <section
      aria-labelledby="getting-started-title"
      className="glow-card col-span-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8"
    >
      <h2 id="getting-started-title" className="text-sm font-semibold text-third">
        Getting started
      </h2>
      <p className="mt-1 text-xs text-third/60">
        Two quick things unlock your calorie estimate and strength ratings. Then set your daily targets in
        Today's macros below.
      </p>

      <ol className="mt-4 flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-secondary/25 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  step.done ? 'border-third bg-third text-main' : 'border-secondary/40 text-transparent'
                }`}
              >
                ✓
              </span>
              <div>
                <p className={step.done ? 'text-third/60 line-through' : 'text-third'}>
                  <span className="sr-only">{step.done ? 'Done: ' : 'To do: '}</span>
                  {step.title}
                </p>
                {!step.done && <p className="text-xs text-third/60">Missing: {step.missing.join(', ')}</p>}
              </div>
            </div>
            {!step.done && (
              <button
                type="button"
                onClick={actions[step.key]}
                className="shrink-0 rounded-lg border border-secondary/40 px-3 py-1.5 text-xs font-medium text-third transition hover:border-secondary active:scale-[0.98]"
              >
                {actionLabels[step.key]}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export default GettingStarted
