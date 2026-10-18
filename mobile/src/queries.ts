import { useQuery } from '@tanstack/react-query'
import type { Me, WeightEntry } from '@gainz/shared/types'
import { api } from './api'

// Read by several screens; TanStack Query fetches each once and shares it.
// Whoever changes one invalidates its key ('me' after PUT /api/me, 'weights'
// after logging or removing a weight) and every reader refreshes.
export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/me') })

// Newest first, as the API returns them.
export const useWeights = () => useQuery({ queryKey: ['weights'], queryFn: () => api<WeightEntry[]>('/api/weights') })
