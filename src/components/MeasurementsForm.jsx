import { useState } from 'react'
import { api } from '../lib/api'
import { useSubmit } from '../lib/useSubmit'

const inputClass =
  'rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary'

function Field({ label, ...input }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-third">{label}</span>
      <input type="number" step="any" className={inputClass} {...input} />
    </label>
  )
}

// First-run form for the Weight card: the numbers the app needs to get going (a
// weight, a height) and the optional goals, in one place instead of three small
// links. Shown while there are no weight entries; afterwards the card's own
// weight/height/goals controls take over. Prefilled from anything already saved.
function MeasurementsForm({ height, weightGoal, bodyFatGoal, onSaved }) {
  const [form, setForm] = useState({
    weightKg: '',
    bodyFatPercent: '',
    heightCm: height ?? '',
    weightGoalKg: weightGoal ?? '',
    bodyFatGoalPercent: bodyFatGoal ?? '',
  })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const { submit, saving, error } = useSubmit(async () => {
    // Profile first, then the weight: the profile write can safely repeat if the
    // weight then fails and the user presses Save again, while a weight entry
    // would be logged twice.
    const profile = {
      ...(form.heightCm ? { heightCm: Number(form.heightCm) } : {}),
      ...(form.weightGoalKg ? { weightGoalKg: Number(form.weightGoalKg) } : {}),
      ...(form.bodyFatGoalPercent ? { bodyFatGoalPercent: Number(form.bodyFatGoalPercent) } : {}),
    }
    if (Object.keys(profile).length > 0) {
      await api('/api/me', { method: 'PUT', body: JSON.stringify(profile) })
    }
    await api('/api/weights', {
      method: 'POST',
      body: JSON.stringify({
        weightKg: Number(form.weightKg),
        ...(form.bodyFatPercent ? { bodyFatPercent: Number(form.bodyFatPercent) } : {}),
      }),
    })
    onSaved()
  }, 'Could not save your measurements: please check the values and try again')

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-xs text-third/60">
        Start with your current numbers. You can change any of this later.
      </p>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-xs font-semibold text-third">Measurements</legend>
        <Field label="Weight (kg)" min="0" required value={form.weightKg} onChange={set('weightKg')} />
        <Field
          label="Body fat % (optional)"
          min="0"
          max="100"
          value={form.bodyFatPercent}
          onChange={set('bodyFatPercent')}
        />
        <Field
          label="Height (cm)"
          min="1"
          required={!height}
          value={form.heightCm}
          onChange={set('heightCm')}
        />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-xs font-semibold text-third">Goals (optional)</legend>
        <Field label="Weight goal (kg)" min="1" value={form.weightGoalKg} onChange={set('weightGoalKg')} />
        <Field
          label="Body fat goal (%)"
          min="0"
          max="100"
          value={form.bodyFatGoalPercent}
          onChange={set('bodyFatGoalPercent')}
        />
      </fieldset>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
      >
        {saving ? 'Saving…' : 'Save measurements'}
      </button>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </form>
  )
}

export default MeasurementsForm
