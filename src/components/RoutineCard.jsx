import { useState } from 'react'
import { api } from '../lib/api'
import { SPLIT_TEMPLATES } from '../lib/templates'
import { useLoad } from '../lib/useLoad'
import { useSubmit, ValidationError } from '../lib/useSubmit'

function RoutineCard({ onSplitChanged }) {
  const [mode, setMode] = useState('view') // 'view' | 'pickTemplate' | 'buildCustom'
  const [name, setName] = useState('')
  const [days, setDays] = useState([])

  const { data: splits, error: loadError, reload } = useLoad(() => api('/api/workout-splits'))

  const { submit, saving, error, setError } = useSubmit(async () => {
    const cleanedDays = days.map((d) => d.trim()).filter(Boolean)
    if (cleanedDays.length === 0) throw new ValidationError('Add at least one day')
    await api('/api/workout-splits', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() || 'My routine', days: cleanedDays }),
    })
    setMode('view')
    reload()
    onSplitChanged?.()
  }, 'Could not save that routine — please check the values and try again')

  const activeSplit = splits?.find((s) => s.active) ?? null

  const startPickTemplate = () => {
    setError(null)
    setMode('pickTemplate')
  }

  const pickTemplate = (template) => {
    setName(template.name)
    setDays(template.days)
    setMode('buildCustom')
  }

  const startCustom = () => {
    setName('')
    setDays(['', ''])
    setMode('buildCustom')
  }

  const updateDay = (index, value) => {
    setDays(days.map((d, i) => (i === index ? value : d)))
  }

  const removeDay = (index) => {
    setDays(days.filter((_, i) => i !== index))
  }

  const addDay = () => {
    setDays([...days, ''])
  }

  const moveDay = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= days.length) return
    const next = [...days]
    ;[next[index], next[target]] = [next[target], next[index]]
    setDays(next)
  }

  const handleDelete = async (id) => {
    await api(`/api/workout-splits/${id}`, { method: 'DELETE' })
    reload()
    onSplitChanged?.()
  }

  // `splits` is undefined until the first successful load.
  const isLoading = splits === undefined

  return (
    <div className="w-full rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-third">Routine</h2>
        {mode === 'view' && activeSplit && (
          <button
            type="button"
            onClick={startPickTemplate}
            className="text-xs font-medium text-third/60 transition hover:text-third"
          >
            Change routine
          </button>
        )}
      </div>

      {isLoading && !loadError && <p className="text-xs text-third/60">Loading…</p>}

      {loadError && (
        <p className="text-xs text-red-400">
          Could not load your routine —{' '}
          <button type="button" onClick={reload} className="underline hover:no-underline">
            retry
          </button>
        </p>
      )}

      {!isLoading && mode === 'view' && !activeSplit && (
        <div className="text-center">
          <p className="mb-3 text-xs text-third/60">
            Create a routine to start tracking your training streak.
          </p>
          <button
            type="button"
            onClick={startPickTemplate}
            className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
          >
            Create a routine
          </button>
        </div>
      )}

      {!isLoading && mode === 'view' && activeSplit && (
        <div>
          <p className="text-sm font-medium text-third">{activeSplit.name}</p>
          <p className="mt-1 text-xs text-third/60">{activeSplit.days.join(' → ')}</p>
        </div>
      )}

      {mode === 'pickTemplate' && (
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
            onClick={() => setMode('view')}
            className="mt-1 rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      )}

      {mode === 'buildCustom' && (
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

          <div className="flex flex-col gap-2">
            <span className="text-sm text-third">Days (in order)</span>
            {days.map((day, index) => (
              <div key={index} className="flex items-center gap-2">
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
                  className="text-third/60 hover:text-red-400"
                  aria-label="Remove day"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addDay}
              className="self-start text-xs font-medium text-third/60 transition hover:text-third"
            >
              + Add day
            </button>
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
              onClick={() => setMode('view')}
              className="rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </form>
      )}

      {!isLoading && mode === 'view' && splits.length > 1 && (
        <div className="mt-4 border-t border-secondary/25 pt-3">
          <p className="mb-2 text-xs text-third/60">Past routines</p>
          <ul className="flex flex-col gap-2">
            {splits
              .filter((s) => !s.active)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-secondary/25 px-3 py-2 text-sm"
                >
                  <span className="text-third/60">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="text-xs font-medium text-third/60 transition hover:text-red-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default RoutineCard
