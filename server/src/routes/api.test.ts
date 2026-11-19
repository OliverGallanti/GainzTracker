import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, testDatabaseUrl } from '../test-app.ts'

// The API end to end against a real (test) Postgres: validation, the client-id
// retry rules, and above all that one user can never read or change another's
// data. See test-app.ts for which database this uses; without one it's skipped.

const url = testDatabaseUrl()

describe.skipIf(!url)('API routes', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>

  beforeAll(async () => {
    t = await startTestApp(url!)
  }, 120_000)

  afterAll(async () => {
    await t?.app.close()
    await t?.prisma.$disconnect()
  })

  type Auth = { authorization: string }
  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, auth?: Auth, payload?: object) =>
    t.app.inject({ method, url: path, headers: auth, ...(payload && { payload }) })

  it('refuses requests without a valid token', async () => {
    expect((await call('GET', '/api/meals')).statusCode).toBe(401)
    expect((await call('GET', '/api/meals', { authorization: 'Bearer not-a-real-token' })).statusCode).toBe(401)
  })

  describe('deleting an account', () => {
    it('needs the confirmation, then erases everything of that user and nobody else', async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      for (const user of [a, b]) {
        await call('POST', '/api/meals', user.auth, { description: 'Banana', calories: 90 })
        await call('POST', '/api/weights', user.auth, { weightKg: 80 })
        await call('POST', '/api/saved-foods', user.auth, { name: 'Oats', calories: 389 })
        await call('PUT', '/api/macro-goal', user.auth, { proteinG: 150, fatG: 70, carbsG: 250 })
        const split = (await call('POST', '/api/workout-splits', user.auth, { name: 'PPL', days: ['Push'] })).json()
        const day = { completed: true, dayIndex: 0, dayStart: '2026-03-02T00:00:00Z', dayEnd: '2026-03-03T00:00:00Z', loggedAt: '2026-03-02T18:00:00Z' }
        const log = (await call('POST', `/api/workout-splits/${split.id}/logs`, user.auth, day)).json()
        await call('PUT', `/api/workout-splits/${split.id}/logs/${log.id}/sets`, user.auth, { sets: [{ exerciseName: 'Bench Press', weightKg: 80, reps: 8 }] })
      }
      const rows = async (userId: string) => {
        const where = { userId }
        const counts = await Promise.all([
          t.prisma.user.count({ where: { id: userId } }),
          t.prisma.macroEntry.count({ where }),
          t.prisma.weightEntry.count({ where }),
          t.prisma.savedFood.count({ where }),
          t.prisma.macroGoal.count({ where }),
          t.prisma.workoutSplit.count({ where }),
          t.prisma.splitLog.count({ where }),
          t.prisma.workoutSet.count({ where }),
          t.prisma.authToken.count({ where }),
        ])
        return counts.reduce((sum, n) => sum + n, 0)
      }
      const before = await rows(a.id)
      expect(before).toBeGreaterThanOrEqual(9)

      expect((await call('DELETE', '/api/me', a.auth)).statusCode).toBe(400)
      expect((await call('DELETE', '/api/me', a.auth, { confirm: 'delete' })).statusCode).toBe(400)
      expect(await rows(a.id)).toBe(before)

      expect((await call('DELETE', '/api/me', a.auth, { confirm: 'DELETE' })).statusCode).toBe(204)
      expect(await rows(a.id)).toBe(0)
      expect((await call('GET', '/api/me', a.auth)).statusCode).toBe(401)
      expect(await rows(b.id)).toBe(before)
      expect((await call('GET', '/api/meals', b.auth)).json()).toHaveLength(1)
    })
  })

  describe('meals', () => {
    it('logs a food with its amount, and refuses invalid values', async () => {
      const a = await t.newUser()
      const res = await call('POST', '/api/meals', a.auth, { description: 'Banana', calories: 112, proteinG: 1.7, amount: 120, unit: 'g', mealName: 'Lunch' })
      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ description: 'Banana', calories: 112, amount: 120, unit: 'g', mealName: 'Lunch', userId: a.id })
      expect((await call('POST', '/api/meals', a.auth, { description: 'Banana', calories: -1 })).statusCode).toBe(400)
      expect((await call('POST', '/api/meals', a.auth, { description: 'Banana', calories: 90, unit: 'cups' })).statusCode).toBe(400)
    })

    it('returns the existing row when the phone resends the same id, and refuses an id someone else used', async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const id = randomUUID()
      const meal = { id, description: 'Oats', calories: 380 }
      expect((await call('POST', '/api/meals', a.auth, meal)).statusCode).toBe(201)
      const again = await call('POST', '/api/meals', a.auth, { ...meal, calories: 999 })
      expect(again.statusCode).toBe(200)
      expect(again.json().calories).toBe(380) // the first one, not a second row
      expect((await call('POST', '/api/meals', b.auth, meal)).statusCode).toBe(409)
      expect(await t.prisma.macroEntry.count({ where: { id } })).toBe(1)
    })

    it("lists only the user's own foods, and only from the requested time on", async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      await call('POST', '/api/meals', a.auth, { description: 'Yesterday', calories: 100, loggedAt: '2026-01-01T10:00:00Z' })
      await call('POST', '/api/meals', a.auth, { description: 'Today', calories: 200, loggedAt: '2026-01-02T10:00:00Z' })
      await call('POST', '/api/meals', b.auth, { description: 'Not yours', calories: 300, loggedAt: '2026-01-02T10:00:00Z' })
      const res = await call('GET', '/api/meals?since=2026-01-02T00:00:00Z', a.auth)
      expect(res.json().map((m: { description: string }) => m.description)).toEqual(['Today'])
    })

    it("edits and deletes only the user's own foods", async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const { id } = (await call('POST', '/api/meals', a.auth, { description: 'Rice', calories: 300, proteinG: 6, mealName: 'Lunch' })).json()

      expect((await call('PATCH', `/api/meals/${id}`, b.auth, { calories: 1 })).statusCode).toBe(404)
      expect((await call('DELETE', `/api/meals/${id}`, b.auth)).statusCode).toBe(404)

      expect((await call('PATCH', `/api/meals/${id}`, a.auth, { calories: 450, proteinG: null, mealName: null, amount: 150, unit: 'g' })).statusCode).toBe(204)
      expect(await t.prisma.macroEntry.findUnique({ where: { id } })).toMatchObject({ calories: 450, proteinG: null, mealName: null, amount: 150, unit: 'g', description: 'Rice' })

      expect((await call('DELETE', `/api/meals/${id}`, a.auth)).statusCode).toBe(204)
      expect((await call('DELETE', `/api/meals/${id}`, a.auth)).statusCode).toBe(404)
    })
  })

  describe('saved foods', () => {
    it('saves per serving by default and replaces a food saved again under the same name', async () => {
      const a = await t.newUser()
      expect((await call('POST', '/api/saved-foods', a.auth, { name: 'Oats', calories: 380 })).json()).toMatchObject({ basis: 'serving', servingG: null })
      await call('POST', '/api/saved-foods', a.auth, { name: 'Oats', calories: 389, basis: '100g', servingG: 40 })
      const list = (await call('GET', '/api/saved-foods', a.auth)).json()
      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({ name: 'Oats', calories: 389, basis: '100g', servingG: 40 })
    })

    it("edits only the user's own foods, and won't rename onto another saved food", async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const oats = (await call('POST', '/api/saved-foods', a.auth, { name: 'Oats', calories: 380 })).json()
      await call('POST', '/api/saved-foods', a.auth, { name: 'Rice', calories: 130 })

      expect((await call('PUT', `/api/saved-foods/${oats.id}`, b.auth, { name: 'Mine now', calories: 1 })).statusCode).toBe(404)
      expect((await call('DELETE', `/api/saved-foods/${oats.id}`, b.auth)).statusCode).toBe(404)
      expect((await call('PUT', `/api/saved-foods/${oats.id}`, a.auth, { name: 'Rice', calories: 380 })).statusCode).toBe(409)

      expect((await call('PUT', `/api/saved-foods/${oats.id}`, a.auth, { name: 'Rolled oats', calories: 389, basis: '100g' })).statusCode).toBe(204)
      expect(await t.prisma.savedFood.findUnique({ where: { id: oats.id } })).toMatchObject({ name: 'Rolled oats', calories: 389, basis: '100g' })
      expect((await call('DELETE', `/api/saved-foods/${oats.id}`, a.auth)).statusCode).toBe(204)
    })

    it('lets two users each save a food with the same name', async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      expect((await call('POST', '/api/saved-foods', a.auth, { name: 'Chili', calories: 450 })).statusCode).toBe(201)
      expect((await call('POST', '/api/saved-foods', b.auth, { name: 'Chili', calories: 500 })).statusCode).toBe(201)
      expect((await call('GET', '/api/saved-foods', a.auth)).json()[0].calories).toBe(450)
    })
  })

  describe('profile and goals', () => {
    it('updates only the fields sent, and refuses bad meal slots', async () => {
      const a = await t.newUser()
      expect((await call('PUT', '/api/me', a.auth, { heightCm: 180 })).statusCode).toBe(200)
      expect((await call('PUT', '/api/me', a.auth, { age: 30 })).statusCode).toBe(200)
      expect((await call('GET', '/api/me', a.auth)).json()).toMatchObject({ heightCm: 180, age: 30, mealNames: ['Breakfast', 'Lunch', 'Dinner'] })
      expect((await call('PUT', '/api/me', a.auth, { mealNames: ['Lunch', 'Lunch'] })).statusCode).toBe(400)
      expect((await call('PUT', '/api/me', a.auth, {})).statusCode).toBe(400)
    })

    it('keeps lift goals per user and only for the Big 4', async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      expect((await call('PUT', '/api/lift-goals', a.auth, { Squat: 150 })).statusCode).toBe(200)
      expect((await call('PUT', '/api/lift-goals', a.auth, { Curl: 40 })).statusCode).toBe(400)
      expect((await call('GET', '/api/lift-goals', a.auth)).json()).toEqual({ Squat: 150 })
      expect((await call('GET', '/api/lift-goals', b.auth)).json()).toEqual({})
    })

    it("keeps each user's weights to themselves", async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const entry = (await call('POST', '/api/weights', a.auth, { weightKg: 80 })).json()
      expect((await call('GET', '/api/weights', b.auth)).json()).toEqual([])
      expect((await call('DELETE', `/api/weights/${entry.id}`, b.auth)).statusCode).toBe(404)
      expect((await call('GET', '/api/weights', a.auth)).json()).toHaveLength(1)
    })

    it('edits a weigh-in, its day included, only for its owner', async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const entry = (await call('POST', '/api/weights', a.auth, { weightKg: 80, bodyFatPercent: 18 })).json()
      const changes = { weightKg: 79.5, bodyFatPercent: null, loggedAt: '2026-11-10T12:00:00.000Z' }
      expect((await call('PATCH', `/api/weights/${entry.id}`, b.auth, changes)).statusCode).toBe(404)
      expect((await call('PATCH', `/api/weights/${entry.id}`, a.auth, { weightKg: -1 })).statusCode).toBe(400)
      const edited = await call('PATCH', `/api/weights/${entry.id}`, a.auth, changes)
      expect(edited.statusCode).toBe(200)
      expect(edited.json()).toMatchObject(changes)
    })
  })

  describe('training', () => {
    const day = { dayStart: '2026-03-02T00:00:00Z', dayEnd: '2026-03-03T00:00:00Z', loggedAt: '2026-03-02T18:00:00Z' }

    it('saves a colour per routine day, only known colours, and keeps the weekly goal', async () => {
      const a = await t.newUser()
      const split = (await call('POST', '/api/workout-splits', a.auth, { name: 'PPL', days: ['Push', 'Pull', 'Legs'], daysPerWeek: 3 })).json()
      expect((await call('PATCH', `/api/workout-splits/${split.id}`, a.auth, { dayColors: { Push: 'gold' } })).statusCode).toBe(400)
      expect((await call('PATCH', `/api/workout-splits/${split.id}`, a.auth, { dayColors: { Push: 'red', Legs: 'blue' } })).statusCode).toBe(204)
      const [saved] = (await call('GET', '/api/workout-splits', a.auth)).json()
      expect(saved).toMatchObject({ daysPerWeek: 3, dayColors: { Push: 'red', Legs: 'blue' } })
      expect((await call('PATCH', `/api/workout-splits/${split.id}`, a.auth, { dayIcons: { Push: 'rocket' } })).statusCode).toBe(400)
      expect((await call('PATCH', `/api/workout-splits/${split.id}`, a.auth, { dayIcons: { Push: 'dumbbell' } })).statusCode).toBe(204)
      expect((await call('GET', '/api/workout-splits', a.auth)).json()[0]).toMatchObject({ dayColors: { Push: 'red', Legs: 'blue' }, dayIcons: { Push: 'dumbbell' } })
    })

    it('edits a routine in place, keeping past days on the same day, and refuses to drop a logged day', async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const split = (await call('POST', '/api/workout-splits', a.auth, { name: 'PPL', days: ['Push', 'Pull', 'Legs'], dayColors: { Legs: 'red' } })).json()
      const on = (d: string) => ({ dayStart: `2026-03-${d}T00:00:00Z`, dayEnd: `2026-03-${d}T23:59:59Z`, loggedAt: `2026-03-${d}T18:00:00Z` })
      await call('POST', `/api/workout-splits/${split.id}/logs`, a.auth, { completed: true, dayIndex: 0, ...on('02') }) // Push
      await call('POST', `/api/workout-splits/${split.id}/logs`, a.auth, { completed: true, dayIndex: 1, ...on('03') }) // Pull
      const url = `/api/workout-splits/${split.id}`
      const namesOfLogs = async () => {
        const [saved] = (await call('GET', '/api/workout-splits', a.auth)).json()
        const logs = (await call('GET', '/api/workout-splits/logs', a.auth)).json()
        return logs.map((l: { dayIndex: number }) => saved.days[l.dayIndex]).sort()
      }

      // Legs has nothing logged: it can go. Pull moves first, Push is renamed, Arms is new.
      const edit = { name: 'PP+', days: [{ name: 'Pull', from: 1 }, { name: 'Chest', from: 0 }, { name: 'Arms', from: null }], daysPerWeek: 3 }
      expect((await call('PUT', url, b.auth, edit)).statusCode).toBe(404)
      const res = await call('PUT', url, a.auth, edit)
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ name: 'PP+', days: ['Pull', 'Chest', 'Arms'], dayColors: {} })
      expect(await namesOfLogs()).toEqual(['Chest', 'Pull'])

      // Pull is logged: leaving it out is refused and changes nothing.
      expect((await call('PUT', url, a.auth, { name: 'X', days: [{ name: 'Chest', from: 1 }] })).statusCode).toBe(409)
      expect((await call('PUT', url, a.auth, { name: 'X', days: [{ name: 'A', from: 0 }, { name: 'B', from: 0 }, { name: 'C', from: 1 }] })).statusCode).toBe(400)
      expect(await namesOfLogs()).toEqual(['Chest', 'Pull'])

      // One training day per calendar day, whichever routine.
      const other = (await call('POST', '/api/workout-splits', a.auth, { name: 'UL', days: ['Upper'] })).json()
      expect((await call('POST', `/api/workout-splits/${other.id}/logs`, a.auth, { completed: true, dayIndex: 0, ...on('02') })).statusCode).toBe(409)
    })

    it('saves day colours and icons given when a routine is created', async () => {
      const a = await t.newUser()
      const body = { name: 'UL', days: ['Upper', 'Lower'], dayColors: { Upper: 'teal' }, dayIcons: { Lower: 'legs' } }
      expect((await call('POST', '/api/workout-splits', a.auth, body)).json()).toMatchObject(body)
    })

    it("logs one day per calendar day, and only on the user's own routine", async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const split = (await call('POST', '/api/workout-splits', a.auth, { name: 'PPL', days: ['Push', 'Pull', 'Legs'] })).json()

      expect((await call('POST', `/api/workout-splits/${split.id}/logs`, b.auth, { completed: true, dayIndex: 0, ...day })).statusCode).toBe(404)
      expect((await call('POST', `/api/workout-splits/${split.id}/logs`, a.auth, { completed: true, dayIndex: 5, ...day })).statusCode).toBe(400)
      expect((await call('POST', `/api/workout-splits/${split.id}/logs`, a.auth, { completed: true, dayIndex: 0, ...day })).statusCode).toBe(201)
      expect((await call('POST', `/api/workout-splits/${split.id}/logs`, a.auth, { completed: false, dayIndex: 1, ...day })).statusCode).toBe(409)
      expect((await call('GET', `/api/workout-splits/${split.id}/logs`, b.auth)).statusCode).toBe(404)
    })

    it("lists every routine's logs in one request, and only the user's own", async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const first = (await call('POST', '/api/workout-splits', a.auth, { name: 'Old', days: ['A'] })).json()
      const second = (await call('POST', '/api/workout-splits', a.auth, { name: 'New', days: ['A'] })).json()
      const other = (await call('POST', '/api/workout-splits', b.auth, { name: 'Theirs', days: ['A'] })).json()
      const next = { dayStart: '2026-03-03T00:00:00Z', dayEnd: '2026-03-04T00:00:00Z', loggedAt: '2026-03-03T18:00:00Z' }
      await call('POST', `/api/workout-splits/${first.id}/logs`, a.auth, { completed: true, dayIndex: 0, ...day })
      await call('POST', `/api/workout-splits/${second.id}/logs`, a.auth, { completed: true, dayIndex: 0, ...next })
      await call('POST', `/api/workout-splits/${other.id}/logs`, b.auth, { completed: true, dayIndex: 0, ...day })

      const logs = (await call('GET', '/api/workout-splits/logs', a.auth)).json()
      expect(logs.map((l: { splitId: string }) => l.splitId)).toEqual([second.id, first.id]) // newest first
    })

    it("won't attach a set to someone else's training day, and takes RPE in half steps", async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const split = (await call('POST', '/api/workout-splits', a.auth, { name: 'Full body', days: ['A'] })).json()
      const log = (await call('POST', `/api/workout-splits/${split.id}/logs`, a.auth, { completed: true, dayIndex: 0, ...day })).json()
      const set = { exerciseName: 'Squat', weightKg: 100, reps: 5 }

      expect((await call('POST', '/api/workout-sets', b.auth, { ...set, splitLogId: log.id })).statusCode).toBe(400)
      expect((await call('POST', '/api/workout-sets', a.auth, { ...set, rpe: 8.3 })).statusCode).toBe(400)
      expect((await call('POST', '/api/workout-sets', a.auth, { ...set, rpe: 8.5, splitLogId: log.id })).statusCode).toBe(201)
      expect((await call('GET', `/api/workout-sets?splitLogId=${log.id}`, b.auth)).json()).toEqual([])
      expect((await call('GET', `/api/workout-sets?splitLogId=${log.id}`, a.auth)).json()[0]).toMatchObject({ rpe: 8.5 })
    })

    it("keeps a timed set's set and rest seconds, and refuses nonsense times", async () => {
      const a = await t.newUser()
      const set = { exerciseName: 'Squat', weightKg: 100, reps: 5 }
      expect((await call('POST', '/api/workout-sets', a.auth, { ...set, durationSeconds: -1 })).statusCode).toBe(400)
      expect((await call('POST', '/api/workout-sets', a.auth, { ...set, restSeconds: 1.5 })).statusCode).toBe(400)
      const saved = await call('POST', '/api/workout-sets', a.auth, { ...set, durationSeconds: 42, restSeconds: 95 })
      expect(saved.statusCode).toBe(201)
      expect((await call('GET', '/api/workout-sets', a.auth)).json()[0]).toMatchObject({ durationSeconds: 42, restSeconds: 95 })
    })

    it("replaces a day's sets all at once, keeps them on a bad request, and only on the user's own day", async () => {
      const a = await t.newUser()
      const b = await t.newUser()
      const split = (await call('POST', '/api/workout-splits', a.auth, { name: 'Push', days: ['A'] })).json()
      const log = (await call('POST', `/api/workout-splits/${split.id}/logs`, a.auth, { completed: true, dayIndex: 0, ...day })).json()
      const url = `/api/workout-splits/${split.id}/logs/${log.id}/sets`
      await call('POST', '/api/workout-sets', a.auth, { exerciseName: 'Old', reps: 1, splitLogId: log.id })
      const names = async () => (await call('GET', `/api/workout-sets?splitLogId=${log.id}`, a.auth)).json().map((s: { exerciseName: string }) => s.exerciseName)

      const sets = [
        { exerciseName: 'Bench Press', weightKg: 80, reps: 8, rpe: 8, durationSeconds: 40 },
        { exerciseName: 'Bench Press', weightKg: 82.5, reps: 6 },
        { exerciseName: 'Dips', reps: 12 },
      ]
      const saved = await call('PUT', url, a.auth, { sets })
      expect(saved.statusCode).toBe(200)
      expect(saved.json()).toHaveLength(3)
      expect((await names()).reverse()).toEqual(['Bench Press', 'Bench Press', 'Dips']) // in the order sent
      expect((await call('PUT', url, a.auth, { sets })).json()).toHaveLength(3) // a retry changes nothing
      expect(await names()).toHaveLength(3)

      // One bad set: refused as a whole, the saved ones untouched.
      expect((await call('PUT', url, a.auth, { sets: [{ exerciseName: 'Squat', reps: 5 }, { exerciseName: '' }] })).statusCode).toBe(400)
      expect(await names()).toHaveLength(3)

      expect((await call('PUT', url, b.auth, { sets: [] })).statusCode).toBe(404)
      expect((await call('PUT', url, a.auth, { sets: [] })).json()).toEqual([])
    })

    it('no longer serves the unused workout routines', async () => {
      const a = await t.newUser()
      expect((await call('GET', '/api/workouts', a.auth)).statusCode).toBe(404)
    })

    it('removes a training day together with its sets', async () => {
      const a = await t.newUser()
      const split = (await call('POST', '/api/workout-splits', a.auth, { name: 'Upper', days: ['A'] })).json()
      const log = (await call('POST', `/api/workout-splits/${split.id}/logs`, a.auth, { completed: true, dayIndex: 0, ...day })).json()
      await call('POST', '/api/workout-sets', a.auth, { exerciseName: 'Bench Press', reps: 8, splitLogId: log.id })
      expect((await call('DELETE', `/api/workout-splits/${split.id}/logs/${log.id}`, a.auth)).statusCode).toBe(204)
      expect(await t.prisma.workoutSet.count({ where: { splitLogId: log.id } })).toBe(0)
    })
  })

  it('limits sign-in requests to 30 a minute per address', async () => {
    const codes = []
    for (let i = 0; i < 31; i++) codes.push((await t.app.inject({ method: 'POST', url: '/auth/logout', remoteAddress: '203.0.113.7' })).statusCode)
    expect(codes.slice(0, 30).includes(429)).toBe(false)
    expect(codes[30]).toBe(429)
    expect((await t.app.inject({ method: 'POST', url: '/auth/logout', remoteAddress: '203.0.113.8' })).statusCode).not.toBe(429)
  })

  it('limits food lookups to 30 a minute per user', async () => {
    const a = await t.newUser()
    const b = await t.newUser()
    // q=x is refused before Open Food Facts is called, but still counts.
    const codes = []
    for (let i = 0; i < 31; i++) codes.push((await call('GET', '/api/products/search?q=x', a.auth)).statusCode)
    expect(codes.slice(0, 30).every((c) => c === 400)).toBe(true)
    expect(codes[30]).toBe(429)
    expect((await call('GET', '/api/products/search?q=x', b.auth)).statusCode).toBe(400) // someone else isn't limited
  })

  it('checks the food search before calling Open Food Facts', async () => {
    const a = await t.newUser()
    expect((await call('GET', '/api/products/search?q=a', a.auth)).statusCode).toBe(400)
    expect((await call('GET', '/api/products/not-a-barcode', a.auth)).statusCode).toBe(400)
  })
})
