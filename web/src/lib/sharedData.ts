import type { Me, WeightEntry } from '@gainz/shared/types'
import { api } from './api'
import { useLoad } from './useLoad'

// Data several cards read. The query cache shares it (one request however many
// cards ask), and `reload()` after a change updates every reader.

// The signed-in user's profile: height, goals, sex, age, activity level, etc.
// Call `reload()` after any PUT /api/me.
export const useMe = () => useLoad<Me>(['me'], () => api('/api/me'))

// All weight entries, newest first (as the API returns them). Call `reload()`
// after logging or deleting one.
export const useWeights = () => useLoad<WeightEntry[]>(['weights'], () => api('/api/weights'))
