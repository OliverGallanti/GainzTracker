import { useState } from 'react'
import { api } from '../lib/api'
import { SPLIT_TEMPLATES } from '@gainz/shared/templates'
import { colorFor, dayColorKey, dayIcon, withDayStyle } from '@gainz/shared/dayColors'
import type { WorkoutSplit } from '@gainz/shared/types'
import { DayStyleButton, DayStylePicker } from './DayStyle'
import { useSubmit, ValidationError } from '../lib/useSubmit'

// Template picker → day builder, for a new routine; or, with `editing`, the day
// builder for the current routine, changed in place. Each day remembers where it
// was (`froms`, null = new) so the server can move past training days with it;
// a day with training logged (`loggedDays`, by position) can't be removed.
// Mounted only while open, so its state resets every time.
function RoutineEditor({
  editing,
  loggedDays,
  onSaved,
  onCancel,
}: {
  editing?: WorkoutSplit
  loggedDays: Set<number>
  onSaved: () => void
  onCancel: () => void
}) {
  const [step, setStep] = useState(editing ? 'build' : 'pick') // 'pick' | 'build'
  const [name, setName] = useState(editing?.name ?? '')
  const [days, setDays] = useState<string[]>(editing?.days ?? [])
  const [froms, setFroms] = useState<(number | null)[]>(editing ? editing.days.map((_, i) => i) : [])
  const [perWeek, setPerWeek] = useState<number | null>(editing?.daysPerWeek ?? null) // null until touched: then it follows the number of days listed
  // Colours and icons by day name, as saved; the row whose picker is open.
  const [styles, setStyles] = useState<{ dayColors: Record<string, string>; dayIcons: Record<string, string> }>({
    dayColors: { ...editing?.dayColors },
    dayIcons: { ...editing?.dayIcons },
  })
  const [styling, setStyling] = useState<number | null>(null)

  const filledDays = days.filter((d) => d.trim()).length
  const hasHistory = (from: number | null | undefined) => from != null && loggedDays.has(from)
  const daysPerWeek = perWeek ?? Math.min(7, Math.max(1, filledDays))

  const { submit, saving, error } = useSubmit(async () => {
    const rows = days.map((d, i) => ({ name: d.trim(), from: froms[i] ?? null }))
    if (rows.some((r) => !r.name && hasHistory(r.from))) throw new ValidationError('A day with training logged needs a name')
    const cleanedDays = rows.filter((r) => r.name).map((r) => r.name)
    if (cleanedDays.length === 0) throw new ValidationError('Add at least one day')
    // Only the days still in the routine (a renamed day leaves its old name behind).
    const kept = (map: Record<string, string>) => Object.fromEntries(Object.entries(map).filter(([day]) => cleanedDays.includes(day)))
    if (editing) {
      await api(`/api/workout-splits/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim() || editing.name,
          days: rows.filter((r) => r.name),
          daysPerWeek,
          dayColors: kept(styles.dayColors),
          dayIcons: kept(styles.dayIcons),
        }),
      })
      onSaved()
      return
    }
    await api('/api/workout-splits', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim() || 'My routine',
        days: cleanedDays,
        daysPerWeek,
        dayColors: kept(styles.dayColors),
        dayIcons: kept(styles.dayIcons),
      }),
    })
    onSaved()
  }, 'Could not save that routine: please check the values and try again')

  const pickTemplate = (template: { name: string; days: string[] }) => {
    setName(template.name)
    setDays(template.days)
    setFroms(template.days.map(() => null))
    setStep('build')
  }

  const startCustom = () => {
    setName('')
    setDays(['', ''])
    setFroms([null, null])
    setStep('build')
  }

  const updateDay = (index: number, value: string) => {
    setDays(days.map((d, i) => (i === index ? value : d)))
  }

  const removeDay = (index: number) => {
    setDays(days.filter((_, i) => i !== index))
    setFroms(froms.filter((_, i) => i !== index))
    setStyling(null) // rows shift: close the picker rather than show it on another day
  }

  const addDay = () => {
    setDays([...days, ''])
    setFroms([...froms, null])
  }

  const moveDay = (index: number, direction: number) => {
    const target = index + direction
    if (target < 0 || target >= days.length) return
    const swap = <T,>(list: T[]) => {
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    }
    setDays(swap(days))
    setFroms(swap(froms))
    setStyling(null)
  }

  if (step === 'pick') {
    return (
      <div className="flex flex-col gap-2">
        {SPLIT_TEMPLATES.map((template) => (
          <button
            key={template.name}
            type="button"
            onClick={() => pickTemplate(template)}
            className="rounded-lg border border-secondary/40 px-3 py-2 text-left text-sm text-third transition hover:border-secondary active:scale-[0.98]"
          >
            <span className="font-medium">{template.name}</span>
            <span className="block text-xs text-third/60">{template.days.join(' → ')}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={startCustom}
          className="rounded-lg border border-dashed border-secondary/40 px-3 py-2 text-left text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
        >
          Custom
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-1 rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-third">Routine name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-third">
          Days per week to count as a good week
          <span className="block text-xs text-third/60">Keeps your weekly streak going.</span>
        </span>
        <select
          value={daysPerWeek}
          onChange={(e) => setPerWeek(Number(e.target.value))}
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-third">Days (in order)</span>
        {days.map((day, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <DayStyleButton
                color={colorFor(dayColorKey(styles, day.trim()))}
                icon={dayIcon(styles, day.trim())}
                active={styling === index}
                disabled={!day.trim()}
                onClick={() => setStyling(styling === index ? null : index)}
              />
              <input
                type="text"
                required
                value={day}
                onChange={(e) => updateDay(index, e.target.value)}
                placeholder="e.g. Push"
                className="flex-1 rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
              />
              <button
                type="button"
                onClick={() => moveDay(index, -1)}
                disabled={index === 0}
                className="text-third/60 hover:text-third disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveDay(index, 1)}
                disabled={index === days.length - 1}
                className="text-third/60 hover:text-third disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeDay(index)}
                disabled={hasHistory(froms[index])}
                title={hasHistory(froms[index]) ? "Has training logged: it can be renamed or moved, not removed" : 'Remove day'}
                className="text-third/60 hover:text-red-400 disabled:opacity-30 disabled:hover:text-third/60"
                aria-label={hasHistory(froms[index]) ? "Has training logged: can't be removed" : 'Remove day'}
              >
                ✕
              </button>
            </div>
            {styling === index && day.trim() && (
              <DayStylePicker
                color={dayColorKey(styles, day.trim())}
                icon={dayIcon(styles, day.trim())}
                onChange={(color, icon) => setStyles(withDayStyle(styles, day.trim(), color, icon))}
              />
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addDay}
          className="self-start text-xs font-medium text-third/60 transition hover:text-third"
        >
          + Add day
        </button>
        {froms.some(hasHistory) && (
          <p className="text-[10px] text-third/60">
            Days with training logged can be renamed or moved, not removed. Their past days move with them.
          </p>
        )}
      </div>

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : 'Save routine'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </form>
  )
}

export default RoutineEditor
