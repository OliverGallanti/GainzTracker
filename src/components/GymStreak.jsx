import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { computeStreak, toLocalDateKey } from '../lib/dates'

function GymStreak() {
  const [streak, setStreak] = useState(null)

  useEffect(() => {
    api('/api/workout-sets').then((sets) => {
      const dateKeys = sets.map((set) => toLocalDateKey(set.performedAt))
      setStreak(computeStreak(dateKeys))
    })
  }, [])

  return (
    <div className="flex w-full items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div>
        <h2 className="text-sm font-semibold text-white">Gym streak</h2>
        <p className="mt-1 text-xs text-neutral-500">Consecutive days with a logged workout</p>
      </div>
      <div className="text-3xl font-bold text-white">
        {streak === null ? '—' : streak}
        <span className="ml-1 text-sm font-normal text-neutral-500">
          {streak === 1 ? 'day' : 'days'}
        </span>
      </div>
    </div>
  )
}

export default GymStreak
