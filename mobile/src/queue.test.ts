import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, dehydrate, hydrate, onlineManager, MutationObserver } from '@tanstack/react-query'
import { QUEUED, registerQueuedMutations, shouldSaveMutation, type AddMealVars, type AddWeightVars, type SaveFoodVars, type UpdateMeVars } from './queue'

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
