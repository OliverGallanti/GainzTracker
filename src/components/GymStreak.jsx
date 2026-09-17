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
    <div className="flex w-full items-center justify-between rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div>
        <h2 className="text-sm font-semibold text-third">Gym streak</h2>
        <p className="mt-1 text-xs text-third/60">Consecutive days with a logged workout</p>
      </div>
      <div className="text-3xl font-bold text-third">
        {streak === null ? '—' : streak}
        <span className="ml-1 text-sm font-normal text-third/60">
          {streak === 1 ? 'day' : 'days'}
        </span>
      </div>
    </div>
  )
}

export default GymStreak
