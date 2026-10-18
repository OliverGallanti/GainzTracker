import { MutationObserver, useMutation, useMutationState, useQueryClient, type Mutation, type QueryClient } from '@tanstack/react-query'
import type { Me, Meal, SavedFood, SplitLog, WeightEntry, WorkoutSet } from '@gainz/shared/types'
import { api } from './api'

// The offline write queue. Each kind of write registers its send function once
// (setMutationDefaults) instead of per call, because a write that's still
// waiting when the app closes is saved to disk and resumed on the next launch,
// and functions can't be saved: only the key and the variables are. So the
// variables must hold everything, including the time it was logged (a food
// logged offline at 9:00 and sent at 18:00 still counts at 9:00) and a
// phone-made id (the server returns the existing row for a repeated id, which
// is what makes retries and resumes safe).
//
// While offline these pause instead of failing (TanStack's 'online' network
// mode), and their onMutate puts the change on screen right away.

type Label = { label: string } // what the "couldn't save" list calls it

export type AddMealVars = Label & {
  meal: Pick<Meal, 'id' | 'description' | 'calories' | 'proteinG' | 'fatG' | 'carbsG' | 'mealName' | 'loggedAt'>
}
export type AddWeightVars = Label & { entry: WeightEntry }
export type UpdateMeVars = Label & {
  changes: Partial<Pick<Me, 'heightCm' | 'sex' | 'age' | 'activityLevel' | 'weightGoalKg' | 'bodyFatGoalPercent'>>
}
// Saved foods are keyed by name on the server (saving a name again replaces it),
// which makes a repeat harmless without a client id.
export type SaveFoodVars = Label & { food: Omit<SavedFood, 'id'> }
export type AddSetVars = Label & { set: WorkoutSet }
// PUT /api/lift-goals replaces only the lifts it names: repeating it is harmless.
export type SetLiftGoalsVars = Label & { goals: Record<string, number> }
export type LogDayVars = Label & {
  splitId: string
  log: Pick<SplitLog, 'id' | 'dayIndex' | 'completed' | 'loggedAt'>
  dayStart: string
  dayEnd: string
}

export const QUEUED = {
  addMeal: ['queue', 'addMeal'],
  addWeight: ['queue', 'addWeight'],
  updateMe: ['queue', 'updateMe'],
  logDay: ['queue', 'logDay'],
  saveFood: ['queue', 'saveFood'],
  addSet: ['queue', 'addSet'],
  setLiftGoals: ['queue', 'setLiftGoals'],
} as const

const without = <T extends { id: string }>(list: T[] | undefined, id: string) => (list ?? []).filter((x) => x.id !== id)

export function registerQueuedMutations(queryClient: QueryClient) {
  const common = {
    networkMode: 'online' as const,
    // One queue, sent in order: e.g. a height set before a weight is sent before it.
    scope: { id: 'queue' },
    // Render's free tier can need a minute to wake up; repeats are safe (ids).
    retry: 3,
  }

  queryClient.setMutationDefaults(QUEUED.addMeal, {
    ...common,
    mutationFn: ({ meal }: AddMealVars) => api('/api/meals', { method: 'POST', body: JSON.stringify(nullsOmitted(meal)) }),
    onMutate: ({ meal }: AddMealVars) => {
      const key = ['today', new Date(meal.loggedAt).toDateString()]
      queryClient.setQueryData<{ meals: Meal[] }>(key, (old) =>
        old ? { ...old, meals: [{ ...meal } as Meal, ...without(old.meals, meal.id)] } : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['today'] }),
  })

  queryClient.setMutationDefaults(QUEUED.addWeight, {
    ...common,
    mutationFn: ({ entry }: AddWeightVars) => api('/api/weights', { method: 'POST', body: JSON.stringify(nullsOmitted(entry)) }),
    onMutate: ({ entry }: AddWeightVars) => {
      queryClient.setQueryData<WeightEntry[]>(['weights'], (old) => (old ? [entry, ...without(old, entry.id)] : old))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['weights'] }),
  })

  queryClient.setMutationDefaults(QUEUED.updateMe, {
    ...common,
    mutationFn: ({ changes }: UpdateMeVars) => api('/api/me', { method: 'PUT', body: JSON.stringify(changes) }),
    onMutate: ({ changes }: UpdateMeVars) => {
      queryClient.setQueryData<Me>(['me'], (old) => (old ? { ...old, ...changes } : old))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  queryClient.setMutationDefaults(QUEUED.saveFood, {
    ...common,
    mutationFn: ({ food }: SaveFoodVars) => api('/api/saved-foods', { method: 'POST', body: JSON.stringify(nullsOmitted(food)) }),
    onMutate: ({ food }: SaveFoodVars) => {
      // A stand-in id until the server's comes back with the refetch.
      queryClient.setQueryData<SavedFood[]>(['savedFoods'], (old) =>
        old
          ? [...old.filter((f) => f.name !== food.name), { ...food, id: `unsent:${food.name}` }].sort((a, b) => a.name.localeCompare(b.name))
          : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['savedFoods'] }),
  })

  queryClient.setMutationDefaults(QUEUED.addSet, {
    ...common,
    mutationFn: ({ set }: AddSetVars) => api('/api/workout-sets', { method: 'POST', body: JSON.stringify(nullsOmitted(set)) }),
    onMutate: ({ set }: AddSetVars) => {
      queryClient.setQueryData<WorkoutSet[]>(['workoutSets'], (old) => (old ? [set, ...without(old, set.id)] : old))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['workoutSets'] }),
  })

  queryClient.setMutationDefaults(QUEUED.setLiftGoals, {
    ...common,
    mutationFn: ({ goals }: SetLiftGoalsVars) => api('/api/lift-goals', { method: 'PUT', body: JSON.stringify(goals) }),
    onMutate: ({ goals }: SetLiftGoalsVars) => {
      queryClient.setQueryData<Record<string, number>>(['liftGoals'], (old) => (old ? { ...old, ...goals } : old))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['liftGoals'] }),
  })

  queryClient.setMutationDefaults(QUEUED.logDay, {
    ...common,
    mutationFn: ({ splitId, log, dayStart, dayEnd }: LogDayVars) =>
      api(`/api/workout-splits/${splitId}/logs`, { method: 'POST', body: JSON.stringify({ ...log, dayStart, dayEnd }) }),
    onMutate: ({ splitId, log }: LogDayVars) => {
      const saved: SplitLog = { ...log, splitId, durationMinutes: null }
      queryClient.setQueryData<{ logs: SplitLog[]; allLogs: SplitLog[] }>(['training'], (old) =>
        old ? { ...old, logs: [saved, ...without(old.logs, log.id)], allLogs: [saved, ...without(old.allLogs, log.id)] } : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['training'] }),
  })
}

// The API's optional fields are "absent", not null.
function nullsOmitted<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null))
}

// Only queued writes are saved with the cache: anything else has no registered
// function to resume with after a restart.
const isQueued = (mutationKey: readonly unknown[] | undefined) => mutationKey?.[0] === 'queue'

// For the persister: unsent queued writes travel with the cache, including one
// cut off mid-send.
export const shouldSaveMutation = (m: Mutation<unknown, Error, unknown, unknown>) =>
  m.state.status === 'pending' && isQueued(m.options.mutationKey)

export function useQueued<TVars>(key: (typeof QUEUED)[keyof typeof QUEUED]) {
  return useMutation<unknown, Error, TVars>({ mutationKey: key })
}

// For the header: how many writes are waiting, and which ones the server refused.
export function useSyncState() {
  const queryClient = useQueryClient()
  const waiting = useMutationState({ filters: { mutationKey: ['queue'], status: 'pending' } }).length
  const failed = useMutationState({
    filters: { mutationKey: ['queue'], status: 'error' },
    select: (m) => ({ mutationId: m.mutationId, key: m.options.mutationKey!, variables: m.state.variables as Label }),
  })

  const dismiss = (mutationId: number) => {
    const mutation = queryClient.getMutationCache().getAll().find((m) => m.mutationId === mutationId)
    if (mutation) queryClient.getMutationCache().remove(mutation)
  }

  // Same key and variables (so the same id): a retry can never create a duplicate.
  const retry = (item: (typeof failed)[number]) => {
    dismiss(item.mutationId)
    void new MutationObserver<unknown, Error, Label>(queryClient, { mutationKey: item.key }).mutate(item.variables).catch(() => {})
  }

  return { waiting, failed, dismiss, retry }
}
