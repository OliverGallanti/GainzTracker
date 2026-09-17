// `value`/`target` are always in the bar's native unit (grams for macros,
// calories for the calorie bar). `multiplier` converts grams -> calories
// (4 kcal/g protein & carbs, 9 kcal/g fat) when `unit` is 'cal' — it's a
// no-op (1) for a bar whose native unit already is calories. The fill
// percentage is always computed from the native value/target ratio, so the
// unit toggle only ever changes what's displayed as text, never the bar.
function LifeBar({ label, value, target, unit = 'g', multiplier = 1 }) {
  const percent = (value / target) * 100
  const clampedPercent = Math.min(percent, 100)
  const overshoot = value > target

  const text =
    unit === 'percent'
      ? `${Math.round(percent)}%`
      : unit === 'cal'
        ? `${Math.round(value * multiplier)} cal / ${Math.round(target * multiplier)} cal`
        : `${Math.round(value)}g / ${Math.round(target)}g`

  const ariaNow = unit === 'percent' ? Math.round(percent) : Math.round(value * (unit === 'cal' ? multiplier : 1))
  const ariaMax = unit === 'percent' ? 100 : Math.round(target * (unit === 'cal' ? multiplier : 1))

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-third">{label}</span>
        <span className="text-third/60">{text}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={ariaNow}
        aria-valuemin={0}
        aria-valuemax={ariaMax}
        aria-valuetext={`${text} ${label}`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/20"
      >
        <div
          className={`h-full rounded-full transition-all ${overshoot ? 'bg-amber-400' : 'bg-third'}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  )
}

export default LifeBar
