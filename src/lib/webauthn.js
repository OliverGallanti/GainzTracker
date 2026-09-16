import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { api } from './api'

// A user cancelling the OS passkey prompt (Escape, closing the dialog) throws
// a DOMException named 'NotAllowedError' — that's an expected, silent outcome,
// not a real error. Anything else is worth surfacing.
export function isPasskeyCancellation(err) {
  return err?.name === 'NotAllowedError'
}

export async function registerPasskey() {
  const options = await api('/auth/passkey/registration/options', { method: 'POST' })
  const response = await startRegistration({ optionsJSON: options })
  await api('/auth/passkey/registration/verify', {
    method: 'POST',
    body: JSON.stringify(response),
  })
}

export async function authenticateWithPasskey() {
  const options = await api('/auth/passkey/authentication/options', { method: 'POST' })
  const response = await startAuthentication({ optionsJSON: options })
  await api('/auth/passkey/authentication/verify', {
    method: 'POST',
    body: JSON.stringify(response),
  })
}
