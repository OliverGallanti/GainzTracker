import { createContext, useContext } from 'react'
import type { Me, WeightEntry } from '@gainz/shared/types'
import type { LoadResult } from './useLoad'

// Resources several cards read. Each is a useLoad result ({ data, error,
// reload }), fetched ONCE by SharedDataProvider. Whoever mutates the
// underlying data calls `reload()` so every other reader updates too.
export const SharedDataContext = createContext<{
  me: LoadResult<Me>
  weights: LoadResult<WeightEntry[]>
} | null>(null)

function useShared() {
  const ctx = useContext(SharedDataContext)
  if (!ctx) throw new Error('useMe/useWeights must be used inside <SharedDataProvider>')
  return ctx
}

// The signed-in user's profile: height, goals, sex, age, activity level, etc.
// Call `reload()` after any PUT /api/me.
export const useMe = () => useShared().me

// All weight entries, newest first (as the API returns them). Call `reload()`
// after logging or deleting one.
export const useWeights = () => useShared().weights
