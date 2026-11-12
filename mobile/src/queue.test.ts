import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryCache, QueryClient, dehydrate, hydrate, onlineManager, MutationObserver } from '@tanstack/react-query'
import { QUEUED, newDayToday, queuedItemId, reapplyQueuedWrites, registerQueuedMutations, shouldSaveMutation, type RemoveVars, type MoveMealVars, type UpdateMealVars, type UpdateSavedFoodVars, type LogDayVars, type UpdateLogVars, type CreateSplitVars, type UpdateSplitVars, type TrainingData, type AddMealVars, type AddSetVars, type AddWeightVars, type SaveFoodVars, type SetLiftGoalsVars, type UpdateMeVars } from './queue'

// The real queue code against a fake server, a fake network switch and a fake
// app restart (dehydrate -> new client -> hydrate), which is what the
// persister does with the saved cache.
const api = vi.hoisted(() => vi.fn())
vi.mock('./api', () => ({ api }))

const today = new Date().toDateString()
const meal: AddMealVars = {
  label: 'Oats',
  meal: { id: 'meal-1', description: 'Oats', calories: 300, proteinG: 10, fatG: null, carbsG: null, mealName: 'Breakfast', loggedAt: new Date().toISOString() },
}

function makeClient() {
  const client = new QueryClient()
  registerQueuedMutations(client)
  return client
}
const mutate = <V,>(client: QueryClient, key: readonly unknown[], vars: V) =>
  new MutationObserver<unknown, Error, V>(client, { mutationKey: key }).mutate(vars).catch(() => {})

// The app restart: only what the persister would save survives.
function restart(client: QueryClient) {
  const saved = JSON.parse(JSON.stringify(dehydrate(client, { shouldDehydrateMutation: shouldSaveMutation })))
  const fresh = makeClient()
  hydrate(fresh, saved)
  return fresh
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  api.mockReset()
  api.mockResolvedValue({})
  onlineManager.setOnline(false)
})
afterEach(() => onlineManager.setOnline(true))

describe('offline write queue', () => {
  it('shows a food straight away offline, without sending it', async () => {
    const client = makeClient()
    client.setQueryData(['today', today], { goal: null, meals: [] })

    void mutate(client, QUEUED.addMeal, meal)
    await flush()

    expect(client.getQueryData<{ meals: { id: string }[] }>(['today', today])!.meals.map((m) => m.id)).toEqual(['meal-1'])
    expect(api).not.toHaveBeenCalled()
    expect(client.getMutationCache().getAll()[0].state.isPaused).toBe(true)
  })

  it('survives an app restart and is sent once when back online, with its id and time', async () => {
    const client = makeClient()
    void mutate(client, QUEUED.addMeal, meal)
    await flush()

    const restarted = restart(client)
    expect(restarted.getMutationCache().getAll()).toHaveLength(1)

    onlineManager.setOnline(true)
    await restarted.resumePausedMutations()

    expect(api).toHaveBeenCalledTimes(1)
    const [path, options] = api.mock.calls[0]
    expect(path).toBe('/api/meals')
    const body = JSON.parse(options.body)
    expect(body).toMatchObject({ id: 'meal-1', description: 'Oats', calories: 300, loggedAt: meal.meal.loggedAt })
    expect(body).not.toHaveProperty('fatG') // nulls are left out, not sent as null
  })

  it('sends queued writes in the order they were made', async () => {
    const client = makeClient()
    void mutate<UpdateMeVars>(client, QUEUED.updateMe, { label: 'Height', changes: { heightCm: 180 } })
    void mutate<AddWeightVars>(client, QUEUED.addWeight, {
      label: '80 kg',
      entry: { id: 'w-1', weightKg: 80, bodyFatPercent: null, loggedAt: new Date().toISOString() },
    })
    await flush()

    const restarted = restart(client)
    onlineManager.setOnline(true)
    await restarted.resumePausedMutations()

    expect(api.mock.calls.map(([path]) => path)).toEqual(['/api/me', '/api/weights'])
  })

  it('does not save writes that are not queued (they have nothing to resume with)', async () => {
    const client = makeClient()
    void new MutationObserver(client, { mutationKey: ['removeMeal'], mutationFn: () => api('/x') }).mutate().catch(() => {})
    void mutate(client, QUEUED.addMeal, meal)
    await flush()

    expect(restart(client).getMutationCache().getAll().map((m) => m.options.mutationKey)).toEqual([QUEUED.addMeal])
  })

  it('reports a write the server refuses as failed, keeping its variables for a retry', async () => {
    onlineManager.setOnline(true)
    api.mockRejectedValue(new Error('Request to /api/meals failed with status 400'))
    const client = makeClient()
    client.setMutationDefaults(QUEUED.addMeal, { ...client.getMutationDefaults(QUEUED.addMeal), retry: 0 })

    await mutate(client, QUEUED.addMeal, meal)

    const [failed] = client.getMutationCache().getAll()
    expect(failed.state.status).toBe('error')
    expect(failed.state.variables).toEqual(meal) // same id, so retrying can't duplicate
  })
})

describe('removes', () => {
  it('takes the item off screen straight away and sends the DELETE after a restart', async () => {
    const client = makeClient()
    client.setQueryData(['today', today], { goal: null, meals: [{ id: 'meal-1' }, { id: 'meal-2' }] })
    client.setQueryData(['training'], { split: null, logs: [{ id: 'log-1' }], allLogs: [{ id: 'log-1' }] })

    void mutate<RemoveVars>(client, QUEUED.remove, { label: 'Remove Oats', path: '/api/meals/meal-1', cacheKey: ['today'], id: 'meal-1' })
    void mutate<RemoveVars>(client, QUEUED.remove, { label: 'Remove day', path: '/api/workout-splits/s/logs/log-1', cacheKey: ['training'], id: 'log-1' })
    await flush()
    expect(client.getQueryData(['today', today])).toEqual({ goal: null, meals: [{ id: 'meal-2' }] })
    expect(client.getQueryData(['training'])).toEqual({ split: null, logs: [], allLogs: [] })

    const restarted = restart(client)
    onlineManager.setOnline(true)
    await restarted.resumePausedMutations()
    expect(api.mock.calls).toEqual([
      ['/api/meals/meal-1', { method: 'DELETE' }],
      ['/api/workout-splits/s/logs/log-1', { method: 'DELETE' }],
    ])
  })

  it('counts a 404 as done (already gone), so a resend is harmless', async () => {
    onlineManager.setOnline(true)
    api.mockRejectedValue(Object.assign(new Error('404'), { status: 404 }))
    const client = makeClient()

    await mutate<RemoveVars>(client, QUEUED.remove, { label: 'x', path: '/api/weights/w-1', cacheKey: ['weights'], id: 'w-1' })
    expect(client.getMutationCache().getAll()[0].state.status).toBe('success')
  })

  it('sends an unsent add before its remove (one queue, in order)', async () => {
    const client = makeClient()
    void mutate(client, QUEUED.addMeal, meal)
    void mutate<RemoveVars>(client, QUEUED.remove, { label: 'x', path: '/api/meals/meal-1', cacheKey: ['today'], id: 'meal-1' })
    await flush()

    onlineManager.setOnline(true)
    await client.resumePausedMutations()
    expect(api.mock.calls.map(([path, o]) => `${o.method} ${path}`)).toEqual(['POST /api/meals', 'DELETE /api/meals/meal-1'])
  })
})

describe('training', () => {
  const split = { id: 's', name: 'PPL', days: ['Push', 'Pull', 'Legs'], daysPerWeek: 3, active: true }
  const log = (id: string, loggedAt: string) => ({ id, splitId: 's', dayIndex: 0, completed: true, loggedAt, durationMinutes: null })

  it('puts a filled-in past day in date order, and edits a logged day in place', async () => {
    const client = makeClient()
    client.setQueryData(['training'], { split, logs: [log('new', '2026-10-10T12:00:00.000Z'), log('old', '2026-10-01T12:00:00.000Z')], allLogs: [] })

    void mutate<LogDayVars>(client, QUEUED.logDay, {
      label: 'Push',
      splitId: 's',
      log: { id: 'mid', dayIndex: 1, completed: true, loggedAt: '2026-10-05T12:00:00.000Z' },
      dayStart: '2026-10-05T00:00:00.000Z',
      dayEnd: '2026-10-06T00:00:00.000Z',
    })
    void mutate<UpdateLogVars>(client, QUEUED.updateLog, { label: 'x', splitId: 's', logId: 'old', changes: { completed: false, durationMinutes: 45 } })
    await flush()

    const data = client.getQueryData<TrainingData>(['training'])!
    expect(data.logs.map((l) => l.id)).toEqual(['new', 'mid', 'old'])
    expect(data.logs[2]).toMatchObject({ completed: false, durationMinutes: 45 })
  })

  it('switches to a new routine straight away and sends it, then the goal change, in order', async () => {
    const client = makeClient()
    client.setQueryData(['training'], { split, logs: [log('a', '2026-10-10T12:00:00.000Z')], allLogs: [log('a', '2026-10-10T12:00:00.000Z')] })

    const routine = { id: 'r2', name: 'Upper/Lower', days: ['Upper', 'Lower'], daysPerWeek: 4 }
    void mutate<CreateSplitVars>(client, QUEUED.createSplit, { label: 'Routine', split: routine })
    void mutate<UpdateSplitVars>(client, QUEUED.updateSplit, { label: 'Goal', splitId: 'r2', daysPerWeek: 2 })
    await flush()

    const data = client.getQueryData<TrainingData>(['training'])!
    expect(data.split).toEqual({ ...routine, daysPerWeek: 2, active: true })
    expect(data.logs).toEqual([])
    expect(data.allLogs).toHaveLength(1) // the old routine's days still count toward the streak

    onlineManager.setOnline(true)
    await client.resumePausedMutations()
    expect(api.mock.calls).toEqual([
      ['/api/workout-splits', { method: 'POST', body: JSON.stringify(routine) }],
      ['/api/workout-splits/r2', { method: 'PATCH', body: JSON.stringify({ daysPerWeek: 2 }) }],
    ])
  })

  it('sends a session exercise with the log it belongs to', async () => {
    const client = makeClient()
    const set = { id: 'set-1', splitLogId: 'log-1', exerciseName: 'Dips', weightKg: null, reps: 10, performedAt: '2026-10-05T12:00:00.000Z' }
    void mutate<AddSetVars>(client, QUEUED.addSet, { label: 'Dips', set })
    onlineManager.setOnline(true)
    await client.resumePausedMutations()
    expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({ id: 'set-1', splitLogId: 'log-1', exerciseName: 'Dips', reps: 10, performedAt: set.performedAt })
  })
})

describe('moving a food between meals', () => {
  it('moves it on screen straight away and sends the new meal, null for Other', async () => {
    const client = makeClient()
    client.setQueryData(['today', today], { goal: null, meals: [{ id: 'meal-1', mealName: 'Lunch' }, { id: 'meal-2', mealName: 'Lunch' }] })

    void mutate<MoveMealVars>(client, QUEUED.moveMeal, { label: 'Move', id: 'meal-1', mealName: null })
    await flush()
    expect(client.getQueryData(['today', today])).toEqual({ goal: null, meals: [{ id: 'meal-1', mealName: null }, { id: 'meal-2', mealName: 'Lunch' }] })

    onlineManager.setOnline(true)
    await client.resumePausedMutations()
    expect(api.mock.calls[0]).toEqual(['/api/meals/meal-1', { method: 'PATCH', body: JSON.stringify({ mealName: null }) }])
  })
})

describe('editing a food', () => {
  it('changes a logged food on screen straight away and sends the changes, nulls included', async () => {
    const client = makeClient()
    client.setQueryData(['today', today], { goal: null, meals: [{ id: 'meal-1', description: 'Banana', calories: 93, mealName: 'Lunch' }] })
    const changes = { description: 'Banana', calories: 140, proteinG: 2, fatG: null, carbsG: 33, mealName: 'Dinner', amount: 150, unit: 'g' as const }

    void mutate<UpdateMealVars>(client, QUEUED.updateMeal, { label: 'Banana', id: 'meal-1', changes })
    await flush()
    expect(client.getQueryData(['today', today])).toEqual({ goal: null, meals: [{ id: 'meal-1', ...changes }] })

    onlineManager.setOnline(true)
    await client.resumePausedMutations()
    expect(api.mock.calls[0]).toEqual(['/api/meals/meal-1', { method: 'PATCH', body: JSON.stringify(changes) }])
  })

  it('replaces a saved food in place, keeping the list sorted, and PUTs it without the id', async () => {
    const client = makeClient()
    client.setQueryData(['savedFoods'], [{ id: 'a', name: 'Apple', calories: 95 }, { id: 'o', name: 'Oats', calories: 389 }])
    const food = { id: 'o', name: 'Avena', calories: 380, proteinG: 13, fatG: null, carbsG: 60, basis: '100g' as const, servingG: 40 }

    void mutate<UpdateSavedFoodVars>(client, QUEUED.updateSavedFood, { label: 'Avena', food })
    await flush()
    expect(client.getQueryData<{ name: string }[]>(['savedFoods'])!.map((f) => f.name)).toEqual(['Apple', 'Avena'])

    onlineManager.setOnline(true)
    await client.resumePausedMutations()
    expect(api.mock.calls[0][0]).toBe('/api/saved-foods/o')
    expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({ name: 'Avena', calories: 380, proteinG: 13, carbsG: 60, basis: '100g', servingG: 40 })
  })
})

describe('saved data while the server is slow', () => {
  it('keeps a write still being sent on screen when a refetch comes back without it', async () => {
    onlineManager.setOnline(true)
    api.mockReturnValue(new Promise(() => {})) // the POST never finishes: a sleeping server
    const client: QueryClient = new QueryClient({ queryCache: new QueryCache({ onSuccess: () => reapplyQueuedWrites(client) }) })
    registerQueuedMutations(client)
    client.setQueryData(['weights'], [])
    const entry = { id: 'w-1', weightKg: 80, bodyFatPercent: null, loggedAt: new Date().toISOString() }

    void mutate<AddWeightVars>(client, QUEUED.addWeight, { label: '80 kg', entry })
    await flush()
    await client.fetchQuery({ queryKey: ['weights'], queryFn: () => [{ id: 'old', weightKg: 79 }] })

    expect(client.getQueryData<{ id: string }[]>(['weights'])!.map((w) => w.id)).toEqual(['w-1', 'old'])
  })

  it('starts a new day from the latest saved targets with no food', () => {
    const client = makeClient()
    expect(newDayToday(client)).toBeUndefined()

    client.setQueryData(['today', 'Mon'], { goal: { proteinG: 1 }, meals: [{ id: 'a' }] }, { updatedAt: 1000 })
    client.setQueryData(['today', 'Tue'], { goal: { proteinG: 2 }, meals: [{ id: 'b' }] }, { updatedAt: 2000 })
    expect(newDayToday(client)).toEqual({ goal: { proteinG: 2 }, meals: [] })
  })
})

describe('not synced yet mark', () => {
  it('finds the on-screen id of each kind of queued add', () => {
    expect(queuedItemId(meal)).toBe('meal-1')
    expect(queuedItemId({ label: '', entry: { id: 'w-1' } })).toBe('w-1')
    expect(queuedItemId({ label: '', set: { id: 'set-1' } })).toBe('set-1')
    expect(queuedItemId({ label: '', log: { id: 'log-1' } })).toBe('log-1')
    expect(queuedItemId({ label: '', goals: {} })).toBeUndefined()
  })
})

describe('saved foods', () => {
  it('shows a saved food in the list straight away, sorted, replacing one with the same name', async () => {
    const client = makeClient()
    client.setQueryData(['savedFoods'], [
      { id: 'a', name: 'Chili', calories: 400, proteinG: 30, fatG: null, carbsG: null },
      { id: 'b', name: 'Oats', calories: 300, proteinG: 10, fatG: null, carbsG: null },
    ])

    void mutate<SaveFoodVars>(client, QUEUED.saveFood, { label: 'Save Apple', food: { name: 'Apple', calories: 95, proteinG: null, fatG: null, carbsG: null } })
    void mutate<SaveFoodVars>(client, QUEUED.saveFood, { label: 'Save Chili', food: { name: 'Chili', calories: 450, proteinG: null, fatG: null, carbsG: null } })
    await flush()

    const list = client.getQueryData<{ name: string; calories: number }[]>(['savedFoods'])!
    expect(list.map((f) => f.name)).toEqual(['Apple', 'Chili', 'Oats'])
    expect(list.find((f) => f.name === 'Chili')!.calories).toBe(450)
  })

  it('is sent by name after a restart (the server replaces by name, so a repeat is harmless)', async () => {
    const client = makeClient()
    void mutate<SaveFoodVars>(client, QUEUED.saveFood, { label: 'Save Apple', food: { name: 'Apple', calories: 95, proteinG: null, fatG: null, carbsG: null } })
    await flush()

    const restarted = restart(client)
    onlineManager.setOnline(true)
    await restarted.resumePausedMutations()

    expect(api).toHaveBeenCalledTimes(1)
    expect(api.mock.calls[0][0]).toBe('/api/saved-foods')
    expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({ name: 'Apple', calories: 95 })
  })
})

describe('Big 4', () => {
  it('shows a logged lift straight away and sends it after a restart with its id and time', async () => {
    const client = makeClient()
    client.setQueryData(['workoutSets'], [])
    const set = { id: 'set-1', exerciseName: 'Squat', weightKg: 100, reps: null, performedAt: new Date().toISOString() }

    void mutate<AddSetVars>(client, QUEUED.addSet, { label: 'Squat 100 kg', set })
    await flush()
    expect(client.getQueryData<{ id: string }[]>(['workoutSets'])!.map((s) => s.id)).toEqual(['set-1'])

    const restarted = restart(client)
    onlineManager.setOnline(true)
    await restarted.resumePausedMutations()

    expect(api.mock.calls[0][0]).toBe('/api/workout-sets')
    expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({ id: 'set-1', exerciseName: 'Squat', weightKg: 100, performedAt: set.performedAt })
  })

  it('merges new lift goals into the shown ones and sends only the changed lifts', async () => {
    const client = makeClient()
    client.setQueryData(['liftGoals'], { Squat: 120, Deadlift: 180 })

    void mutate<SetLiftGoalsVars>(client, QUEUED.setLiftGoals, { label: 'Lift goals', goals: { Squat: 140 } })
    await flush()
    expect(client.getQueryData(['liftGoals'])).toEqual({ Squat: 140, Deadlift: 180 })

    onlineManager.setOnline(true)
    await client.resumePausedMutations()
    expect(api.mock.calls[0]).toEqual(['/api/lift-goals', { method: 'PUT', body: JSON.stringify({ Squat: 140 }) }])
  })
})
