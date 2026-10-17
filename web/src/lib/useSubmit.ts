import { useState } from 'react'

// Throw this from an action to reject the input with a message that IS meant
// for the user ("Add at least one day"). Anything else thrown is treated as an
// unexpected failure and replaced with the generic `errorMessage`.
export class ValidationError extends Error {}

// The submit dance, as a plain function so it can be tested without a renderer:
// disable the control while in flight, clear the previous error, run, surface a
// message if it fails, re-enable either way.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers pass events or plain values
type Args = any[]

export async function runSubmit({
  action,
  args = [],
  errorMessage,
  setSaving,
  setError,
}: {
  action: (...args: Args) => unknown
  args?: Args
  errorMessage: string
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void
}) {
  // No-ops for non-event arguments, so callers don't need two entry points.
  args[0]?.preventDefault?.()
  setSaving(true)
  setError(null)
  try {
    await action(...args)
  } catch (err) {
    // Only a ValidationError's text is shown. Anything else is raw API text
    // like "Request to /api/me failed with status 500" — not for a user.
    setError(err instanceof ValidationError ? err.message : errorMessage)
  } finally {
    setSaving(false)
  }
}

// `action` receives whatever `submit` was called with, so this works for both
// form submits (`onSubmit={submit}`) and plain handlers (`submit(true)`).
// `setError` is exposed so a caller can clear a stale message on its own
// (e.g. when the user reopens the form).
export function useSubmit(action: (...args: Args) => unknown, errorMessage: string) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = (...args: Args) => runSubmit({ action, args, errorMessage, setSaving, setError })

  return { submit, saving, error, setError }
}
