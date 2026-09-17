function LifeBar({ label, valueG, targetG }) {
  const percent = (valueG / targetG) * 100
  const clampedPercent = Math.min(percent, 100)
  const overshoot = valueG > targetG

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-neutral-300">{label}</span>
        <span className="text-neutral-500">
          {Math.round(valueG)}g / {Math.round(targetG)}g
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(valueG)}
        aria-valuemin={0}
        aria-valuemax={Math.round(targetG)}
        aria-valuetext={`${Math.round(valueG)}g of ${Math.round(targetG)}g ${label}`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800"
      >
        <div
          className={`h-full rounded-full transition-all ${overshoot ? 'bg-amber-400' : 'bg-white'}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  )
}

export default LifeBar
