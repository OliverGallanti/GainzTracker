import { MutationObserver, useMutation, useMutationState, useQueryClient, type Mutation, type QueryClient } from '@tanstack/react-query'
import type { MacroGoal, Me, Meal, SavedFood, SplitLog, WeightEntry, WorkoutSet, WorkoutSplit } from '@gainz/shared/types'
import type { LiftGoalsBody, UpdateLogBody, UpdateMealBody, UpdateSplitBody } from '@gainz/shared/schemas'
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
  meal: Pick<Meal, 'id' | 'description' | 'calories' | 'proteinG' | 'fatG' | 'carbsG' | 'mealName' | 'amount' | 'unit' | 'loggedAt'>
}
// null = "Other". A PATCH to a value: repeating it is harmless.
export type MoveMealVars = Label & { id: string; mealName: string | null }
// Edits a logged food (moveMeal is the older, mealName-only form: still
// registered so a move saved by an older app version is still sent).
export type UpdateMealVars = Label & { id: string; changes: UpdateMealBody }
// PUT replaces the row: repeating it is harmless.
export type UpdateSavedFoodVars = Label & { food: SavedFood }
export type AddWeightVars = Label & { entry: WeightEntry }
export type UpdateMeVars = Label & {
  changes: Partial<Pick<Me, 'heightCm' | 'sex' | 'age' | 'activityLevel' | 'weightGoalKg' | 'bodyFatGoalPercent'>>
}
// Saved foods are keyed by name on the server (saving a name again replaces it),
// which makes a repeat harmless without a client id.
export type SaveFoodVars = Label & { food: Omit<SavedFood, 'id'> }
export type AddSetVars = Label & { set: WorkoutSet }
// PUT /api/lift-goals replaces only the lifts it names: repeating it is harmless.
export type SetLiftGoalsVars = Label & { goals: LiftGoalsBody }
export type LogDayVars = Label & {
  splitId: string
  log: Pick<SplitLog, 'id' | 'dayIndex' | 'completed' | 'loggedAt'>
  dayStart: string
  dayEnd: string
}
// PATCHes set fields to values: repeating one is harmless.
export type UpdateLogVars = Label & {
  splitId: string
  logId: string
  changes: UpdateLogBody
}
export type UpdateSplitVars = Label & { splitId: string } & UpdateSplitBody
// Creating a routine makes it the active one (the server deactivates the rest).
export type CreateSplitVars = Label & { split: Pick<WorkoutSplit, 'id' | 'name' | 'days'> & { daysPerWeek: number } }

// The Training tab's query: the streak counts every routine's logs, the rest
// only the active routine's.
export type TrainingData = { split: WorkoutSplit | null; logs: SplitLog[]; allLogs: SplitLog[] }

// One kind for every remove. `cacheKey` is the query (or prefix, e.g. ['today']
// covers every day) the item is shown in; it's taken out of any list there.
export type RemoveVars = Label & { path: string; cacheKey: readonly unknown[]; id: string }

export const QUEUED = {
  remove: ['queue', 'remove'],
  addMeal: ['queue', 'addMeal'],
  moveMeal: ['queue', 'moveMeal'],
  updateMeal: ['queue', 'updateMeal'],
  updateSavedFood: ['queue', 'updateSavedFood'],
  addWeight: ['queue', 'addWeight'],
  updateMe: ['queue', 'updateMe'],
  logDay: ['queue', 'logDay'],
  updateLog: ['queue', 'updateLog'],
  updateSplit: ['queue', 'updateSplit'],
  createSplit: ['queue', 'createSplit'],
  saveFood: ['queue', 'saveFood'],
  addSet: ['queue', 'addSet'],
  setLiftGoals: ['queue', 'setLiftGoals'],
} as const

const without = <T extends { id: string }>(list: T[] | undefined, id: string) => (list ?? []).filter((x) => x.id !== id)

// Removes an id from a cached list, or from every list in a cached object
// (today's { goal, meals }, training's { logs, allLogs }).
function dropId(data: unknown, id: string): unknown {
  if (Array.isArray(data)) return without(data, id)
  if (data && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? without(v, id) : v]))
  }
  return data
}

export function registerQueuedMutations(queryClient: QueryClient) {
  const common = {
    networkMode: 'online' as const,
    // One queue, sent in order: e.g. a height set before a weight is sent before it.
    scope: { id: 'queue' },
    // Render's free tier can need a minute to wake up; repeats are safe (ids).
    retry: 3,
  }

  queryClient.setMutationDefaults(QUEUED.remove, {
    ...common,
    // 404 = already gone (a resend after a cut-off reply, or removed on the web): done.
    mutationFn: ({ path }: RemoveVars) =>
      api(path, { method: 'DELETE' }).catch((err: { status?: number }) => {
        if (err.status !== 404) throw err
      }),
    onMutate: ({ cacheKey, id }: RemoveVars) => {
      queryClient.setQueriesData({ queryKey: cacheKey }, (old: unknown) => dropId(old, id))
    },
    onSettled: (_data, _error, { cacheKey }: RemoveVars) => queryClient.invalidateQueries({ queryKey: cacheKey }),
  })

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

  queryClient.setMutationDefaults(QUEUED.moveMeal, {
    ...common,
    mutationFn: ({ id, mealName }: MoveMealVars) => api(`/api/meals/${id}`, { method: 'PATCH', body: JSON.stringify({ mealName }) }),
    onMutate: ({ id, mealName }: MoveMealVars) => {
      queryClient.setQueriesData<{ meals: Meal[] }>({ queryKey: ['today'] }, (old) =>
        old ? { ...old, meals: old.meals.map((m) => (m.id === id ? { ...m, mealName } : m)) } : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['today'] }),
  })

  queryClient.setMutationDefaults(QUEUED.updateMeal, {
    ...common,
    mutationFn: ({ id, changes }: UpdateMealVars) => api(`/api/meals/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
    onMutate: ({ id, changes }: UpdateMealVars) => {
      queryClient.setQueriesData<{ meals: Meal[] }>({ queryKey: ['today'] }, (old) =>
        old ? { ...old, meals: old.meals.map((m) => (m.id === id ? { ...m, ...changes } : m)) } : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['today'] }),
  })

  queryClient.setMutationDefaults(QUEUED.updateSavedFood, {
    ...common,
    mutationFn: ({ food: { id, ...food } }: UpdateSavedFoodVars) =>
      api(`/api/saved-foods/${id}`, { method: 'PUT', body: JSON.stringify(nullsOmitted(food)) }),
    onMutate: ({ food }: UpdateSavedFoodVars) => {
      queryClient.setQueryData<SavedFood[]>(['savedFoods'], (old) =>
        old ? old.map((f) => (f.id === food.id ? food : f)).sort((a, b) => a.name.localeCompare(b.name)) : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['savedFoods'] }),
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
      // Newest first, like the API: a past day filled in goes in its place, not on top.
      const insert = (list: SplitLog[]) => [...without(list, log.id), saved].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
      queryClient.setQueryData<TrainingData>(['training'], (old) =>
        old ? { ...old, logs: insert(old.logs), allLogs: insert(old.allLogs) } : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['training'] }),
  })

  queryClient.setMutationDefaults(QUEUED.updateLog, {
    ...common,
    mutationFn: ({ splitId, logId, changes }: UpdateLogVars) =>
      api(`/api/workout-splits/${splitId}/logs/${logId}`, { method: 'PATCH', body: JSON.stringify(changes) }),
    onMutate: ({ logId, changes }: UpdateLogVars) => {
      const patch = (list: SplitLog[]) => list.map((l) => (l.id === logId ? { ...l, ...changes } : l))
      queryClient.setQueryData<TrainingData>(['training'], (old) =>
        old ? { ...old, logs: patch(old.logs), allLogs: patch(old.allLogs) } : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['training'] }),
  })

  queryClient.setMutationDefaults(QUEUED.updateSplit, {
    ...common,
    mutationFn: ({ splitId, daysPerWeek }: UpdateSplitVars) =>
      api(`/api/workout-splits/${splitId}`, { method: 'PATCH', body: JSON.stringify({ daysPerWeek }) }),
    onMutate: ({ splitId, daysPerWeek }: UpdateSplitVars) => {
      queryClient.setQueryData<TrainingData>(['training'], (old) =>
        old?.split?.id === splitId ? { ...old, split: { ...old.split, daysPerWeek } } : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['training'] }),
  })

  queryClient.setMutationDefaults(QUEUED.createSplit, {
    ...common,
    mutationFn: ({ split }: CreateSplitVars) => api('/api/workout-splits', { method: 'POST', body: JSON.stringify(split) }),
    onMutate: ({ split }: CreateSplitVars) => {
      queryClient.setQueryData<TrainingData>(['training'], (old) => (old ? { ...old, split: { ...split, active: true }, logs: [] } : old))
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

// A refetch returns what the server has, which doesn't include writes still on
// their way (a sleeping server can take a minute): put them back on top, or
// they'd vanish from the screen until they're sent. Every onMutate is safe to
// repeat, and running them in queue order gives the same result as the first time.
export function reapplyQueuedWrites(client: QueryClient) {
  for (const m of client.getMutationCache().getAll()) {
    if (m.state.status === 'pending' && isQueued(m.options.mutationKey)) {
      void m.options.onMutate?.(m.state.variables, { client, meta: m.options.meta, mutationKey: m.options.mutationKey })
    }
  }
}

// Today's cache is per date, so the first open of a day has nothing saved. Rather
// than wait for the server: the latest saved day's targets, with no food yet.
export function newDayToday(client: QueryClient) {
  const [latest] = client
    .getQueryCache()
    .findAll({ queryKey: ['today'] })
    .filter((q) => q.state.data)
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
  const saved = latest?.state.data as { goal: MacroGoal | null } | undefined
  return saved && { goal: saved.goal, meals: [] as Meal[] }
}

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

// The id of the row a queued add puts on screen (removes take theirs off, so
// they never need a mark).
export const queuedItemId = (vars: unknown) => {
  const v = vars as Partial<AddMealVars & AddWeightVars & AddSetVars & LogDayVars>
  return v.meal?.id ?? v.entry?.id ?? v.set?.id ?? v.log?.id
}

// Ids of rows on screen the server doesn't have yet: queued adds still waiting
// or refused (the header offers Retry/Dismiss for those).
export function useUnsyncedIds() {
  const ids = useMutationState({
    filters: { mutationKey: ['queue'], predicate: (m) => m.state.status === 'pending' || m.state.status === 'error' },
    select: (m) => queuedItemId(m.state.variables),
  })
  return new Set(ids.filter(Boolean))
}
