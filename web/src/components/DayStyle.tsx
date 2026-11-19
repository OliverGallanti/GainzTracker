import type { LucideIcon } from 'lucide-react'
import { Activity, BicepsFlexed, Bike, Dumbbell, Flame, Footprints, HeartPulse, Mountain, Palette, PersonStanding, Target, Waves, X, Zap } from 'lucide-react'
import { colorFor, DAY_COLOR_KEYS, DAY_ICON_KEYS, DAY_ICONS, type DayColor, type DayIcon } from '@gainz/shared/dayColors'

// The same icons as the phone (mobile/src/screens/training/dayStyle.tsx).
export const DAY_ICON_COMPONENTS: Record<DayIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  biceps: BicepsFlexed,
  legs: Footprints,
  endurance: Activity,
  bike: Bike,
  cardio: HeartPulse,
  core: Target,
  stretch: PersonStanding,
  swim: Waves,
  hike: Mountain,
  flame: Flame,
  power: Zap,
}

// A routine day as a pill, filled with its colour and led by its icon. With
// onClick it's a button (opens the day's picker).
export function DayPill({
  name,
  color,
  icon,
  active = false,
  onClick,
}: {
  name: string
  color: string | null
  icon: DayIcon | null
  active?: boolean
  onClick?: () => void
}) {
  const Icon = icon ? DAY_ICON_COMPONENTS[icon] : null
  const className = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
    color ? 'text-main' : 'border-secondary/40 text-third'
  } ${active ? 'ring-2 ring-third' : ''}`
  const style = color ? { backgroundColor: color, borderColor: color } : undefined
  const content = (
    <>
      {Icon && <Icon size={13} />}
      {name}
    </>
  )
  if (!onClick) return <span className={className} style={style}>{content}</span>
  return (
    <button type="button" onClick={onClick} aria-expanded={active} title="Colour and icon" className={`${className} hover:opacity-90`} style={style}>
      {content}
    </button>
  )
}

// Beside a day's name in the routine editor: shows its colour and icon (a
// palette while it has neither) and toggles the picker.
export function DayStyleButton({ color, icon, active, disabled, onClick }: { color: string | null; icon: DayIcon | null; active: boolean; disabled?: boolean; onClick: () => void }) {
  const Icon = icon ? DAY_ICON_COMPONENTS[icon] : Palette
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={active}
      aria-label="Colour and icon"
      title={disabled ? 'Name the day first' : 'Colour and icon'}
      style={color ? { backgroundColor: color, borderColor: color } : undefined}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-30 ${
        color ? 'text-main' : 'border-secondary/40 text-third/60 hover:text-third'
      } ${active ? 'ring-2 ring-third' : ''}`}
    >
      <Icon size={15} />
    </button>
  )
}

// One day's colour (none + 7) and icon (tap the chosen one again to remove
// it). Each click applies straight away.
export function DayStylePicker({
  color,
  icon,
  disabled = false,
  onChange,
}: {
  color: DayColor | null
  icon: DayIcon | null
  disabled?: boolean
  onChange: (color: DayColor | null, icon: DayIcon | null) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-secondary/25 p-3">
      <div>
        <p className="mb-2 text-xs text-third/60">Colour</p>
        <div className="flex flex-wrap gap-2">
          {([null, ...DAY_COLOR_KEYS] as (DayColor | null)[]).map((key) => (
            <button
              key={key ?? 'none'}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key, icon)}
              aria-label={key ?? 'No colour'}
              aria-pressed={color === key}
              style={{ backgroundColor: colorFor(key) ?? undefined }}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${
                color === key ? 'border-third' : key ? 'border-transparent hover:border-third/40' : 'border-secondary/40 hover:border-third/40'
              }`}
            >
              {!key && <X size={13} className="text-third/60" />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs text-third/60">Icon (click the chosen one again to remove it)</p>
        <div className="grid grid-cols-6 gap-2">
          {DAY_ICON_KEYS.map((key) => {
            const Icon = DAY_ICON_COMPONENTS[key]
            const picked = icon === key
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onChange(color, picked ? null : key)}
                aria-label={DAY_ICONS[key]}
                aria-pressed={picked}
                title={DAY_ICONS[key]}
                className={`flex h-9 items-center justify-center rounded-lg border transition ${
                  picked ? 'border-third bg-third text-main' : 'border-secondary/40 text-third hover:border-secondary'
                }`}
              >
                <Icon size={17} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

