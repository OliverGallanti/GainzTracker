import { describe, expect, it, vi } from 'vitest'
import { runSubmit, ValidationError } from './useSubmit'

// Captures what the hook's state would have been, in order, so the ordering
// contract (disable -> clear -> run -> report -> re-enable) is checked too.
function spyState() {
  const savingCalls = []
  const errorCalls = []
  return {
    savingCalls,
    errorCalls,
    setSaving: (v) => savingCalls.push(v),
    setError: (v) => errorCalls.push(v),
  }
}

describe('runSubmit', () => {
  it('disables, clears the old error, then re-enables on success', async () => {
    const s = spyState()
    await runSubmit({ action: async () => {}, errorMessage: 'nope', ...s })
    expect(s.savingCalls).toEqual([true, false])
    expect(s.errorCalls).toEqual([null])
  })

  it('re-enables even when the action throws', async () => {
    const s = spyState()
    await runSubmit({ action: async () => { throw new Error('boom') }, errorMessage: 'nope', ...s })
    expect(s.savingCalls).toEqual([true, false])
  })

  it('shows the caller-supplied message, never the raw API error', async () => {
    const s = spyState()
    await runSubmit({
      action: async () => { throw new Error('Request to /api/me failed with status 500') },
      errorMessage: 'Could not save your goals',
      ...s,
    })
    expect(s.errorCalls).toEqual([null, 'Could not save your goals'])
  })

  it('shows a ValidationError message verbatim, since it is written for the user', async () => {
    const s = spyState()
    await runSubmit({
      action: async () => { throw new ValidationError('Add at least one day') },
      errorMessage: 'Could not save that routine',
      ...s,
    })
    expect(s.errorCalls).toEqual([null, 'Add at least one day'])
    expect(s.savingCalls).toEqual([true, false])
  })

  it('does not treat a plain Error whose text looks friendly as validation', async () => {
    // Only the explicit ValidationError type opts in; everything else is generic.
    const s = spyState()
    await runSubmit({
      action: async () => { throw new Error('Add at least one day') },
      errorMessage: 'Could not save that routine',
      ...s,
    })
    expect(s.errorCalls).toEqual([null, 'Could not save that routine'])
  })

  it('calls preventDefault when handed a form event', async () => {
    const preventDefault = vi.fn()
    await runSubmit({ action: async () => {}, args: [{ preventDefault }], errorMessage: 'nope', ...spyState() })
    expect(preventDefault).toHaveBeenCalledOnce()
  })

  it('forwards non-event arguments to the action untouched', async () => {
    const action = vi.fn()
    await runSubmit({ action, args: [true], errorMessage: 'nope', ...spyState() })
    expect(action).toHaveBeenCalledWith(true)
  })

  it('does not blow up on a primitive argument with no preventDefault', async () => {
    const s = spyState()
    await expect(
      runSubmit({ action: async () => {}, args: ['skipped'], errorMessage: 'nope', ...s }),
    ).resolves.toBeUndefined()
    expect(s.savingCalls).toEqual([true, false])
  })

  it('swallows the rejection rather than letting it escape as unhandled', async () => {
    await expect(
      runSubmit({ action: async () => { throw new Error('boom') }, errorMessage: 'nope', ...spyState() }),
    ).resolves.toBeUndefined()
  })
})
