import { describe, expect, it } from 'vitest'
import { describeTiming, formatSeconds, lastSessionPlan, setRow, setsBody, toSetRows } from './sessions'

const split = { id: 's', name: 'PPL', days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'], daysPerWeek: 6, active: true }
const log = (id, dayIndex, day, completed = true) => ({ id, splitId: 's', dayIndex, completed, loggedAt: `2026-11-${day}T18:00:00.000Z`, durationMinutes: null })
const set = (splitLogId, exerciseName, weightKg, reps, performedAt = '2026-11-01T18:00:00.000Z') => ({
  id: `${splitLogId}-${exerciseName}-${weightKg}-${reps}`,
  splitLogId,
  exerciseName,
  weightKg,
  reps,
  performedAt,
})

describe('lastSessionPlan', () => {
  it("plans from the newest done session of the same day, the second Push included", () => {
    const logs = [log('old', 0, '01'), log('pull', 1, '02'), log('new', 3, '04')]
    // newest first, as the API lists them
    const sets = [
      set('new', 'Dips', 0, 12, '2026-11-04T18:20:00.000Z'),
      set('new', 'Bench Press', 82.5, 6, '2026-11-04T18:10:00.000Z'),
      set('new', 'Bench Press', 80, 8, '2026-11-04T18:05:00.000Z'),
      set('pull', 'Row', 60, 10),
      set('old', 'Bench Press', 70, 8),
    ]
    expect(lastSessionPlan(split, logs, sets, 0)).toEqual([
      { name: 'Bench Press', sets: [{ weightKg: 80, reps: 8 }, { weightKg: 82.5, reps: 6 }] },
      { name: 'Dips', sets: [{ weightKg: 0, reps: 12 }] },
    ])
  })

  it('keeps the entry order of sets saved together (same time)', () => {
    const sets = [set('a', 'Squat', 100, 5), set('a', 'Squat', 90, 8), set('a', 'Lunge', 20, 10)].reverse()
    expect(lastSessionPlan(split, [log('a', 2, '03')], sets, 2).map((e) => e.name)).toEqual(['Squat', 'Lunge'])
    expect(lastSessionPlan(split, [log('a', 2, '03')], sets, 2)[0].sets.map((s) => s.weightKg)).toEqual([100, 90])
  })

  it('skips skipped days, days without sets and the session being done now', () => {
    const logs = [log('skipped', 0, '05', false), log('empty', 0, '04'), log('today', 0, '06'), log('real', 0, '01')]
    const sets = [set('today', 'Bench Press', 90, 3), set('real', 'Bench Press', 70, 8)]
    expect(lastSessionPlan(split, logs, sets, 0, 'today')).toEqual([{ name: 'Bench Press', sets: [{ weightKg: 70, reps: 8 }] }])
  })

  it('is empty the first time a day is trained', () => {
    expect(lastSessionPlan(split, [log('pull', 1, '02')], [set('pull', 'Row', 60, 10)], 0)).toEqual([])
  })
})

describe('formatSeconds', () => {
  it('shows minutes and seconds, and hours past an hour', () => {
    expect(formatSeconds(0)).toBe('0:00')
    expect(formatSeconds(65)).toBe('1:05')
    expect(formatSeconds(90.9)).toBe('1:30')
    expect(formatSeconds(3725)).toBe('1:02:05')
    expect(formatSeconds(-3)).toBe('0:00')
  })
})

describe('describeTiming', () => {
  it('describes what was timed, nothing for an untimed set', () => {
    expect(describeTiming({ durationSeconds: 45, restSeconds: 90 })).toBe('0:45 · rest 1:30')
    expect(describeTiming({ durationSeconds: 45, restSeconds: null })).toBe('0:45')
    expect(describeTiming({})).toBe('')
  })
})

describe('setsBody', () => {
  it('sends the filled rows, numbers as numbers, and keeps what the form hides', () => {
    const timed = { id: 'x', exerciseName: 'Squat', weightKg: 100, reps: 5, rpe: 8, durationSeconds: 40, restSeconds: null, performedAt: '2026-11-14T18:00:00.000Z' }
    expect(
      setsBody([
        setRow(timed),
        { exerciseName: ' Dips ', weightKg: '', reps: '12' },
        { exerciseName: '', weightKg: '20', reps: '5' },
        { exerciseName: 'Row', weightKg: 'abc', reps: '' },
      ]),
    ).toEqual({
      sets: [
        { exerciseName: 'Squat', weightKg: 100, reps: 5, rpe: 8, durationSeconds: 40, performedAt: '2026-11-14T18:00:00.000Z' },
        { exerciseName: 'Dips', reps: 12 },
        { exerciseName: 'Row' },
      ],
    })
  })
})

describe('sets per row', () => {
  const untimed = (id, weightKg, reps, performedAt) => ({ id, splitLogId: 'l', exerciseName: 'Squat', weightKg, reps, performedAt })

  it('sends a row done 3 times as 3 sets, a blank count as 1', () => {
    const body = setsBody([
      { exerciseName: 'Squat', weightKg: '100', reps: '5', sets: '3' },
      { exerciseName: 'Dips', weightKg: '', reps: '12', sets: '' },
      { exerciseName: 'Row', weightKg: '60', reps: '10', sets: '0' },
    ])
    expect(body.sets.map((s) => s.exerciseName)).toEqual(['Squat', 'Squat', 'Squat', 'Dips', 'Row'])
  })

  it('folds repeats back into one row, in the order done', () => {
    // newest first, as the API lists them
    const sets = [untimed('c', 90, 8, '3'), untimed('b', 100, 5, '2'), untimed('a', 100, 5, '1')]
    const rows = toSetRows(sets)
    expect(rows.map((r) => [r.weightKg, r.reps, r.sets])).toEqual([['100', '5', '2'], ['90', '8', undefined]])
    expect(setsBody(rows).sets).toHaveLength(3)
  })

  it('keeps timed sets on their own rows', () => {
    const timed = (id, at) => ({ ...untimed(id, 100, 5, at), durationSeconds: 40, restSeconds: 90 })
    expect(toSetRows([timed('b', '2'), timed('a', '1')])).toHaveLength(2)
  })
})
