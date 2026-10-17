import { useState } from 'react'
import { api } from '../lib/api'
import { useSubmit } from '../lib/useSubmit'

function HeightForm({
  height,
  onSaved,
  onCancel,
}: { height: number | null | undefined; onSaved: () => void; onCancel: () => void }) {
  const [heightCm, setHeightCm] = useState(height ?? '')

  const { submit, saving, error } = useSubmit(async () => {
    await api('/api/me', { method: 'PUT', body: JSON.stringify({ heightCm: Number(heightCm) }) })
    onSaved()
  }, 'Could not save your height: please check the value and try again')

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-third">Height (cm)</span>
        <input
          type="number"
          min="1"
          step="any"
          required
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          className="w-24 rounded-lg border border-secondary/40 bg-main px-2 py-1 text-right text-third outline-none focus:border-secondary"
        />
      </label>

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-third px-4 py-2 text-sm font-medium text-main transition hover:bg-third/90 disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? 'Saving…' : 'Save'}
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

export default HeightForm
