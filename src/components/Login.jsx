import { useState } from 'react'
import { authenticateWithPasskey, isPasskeyCancellation } from '../lib/webauthn'

function handleGoogleSignIn() {
  window.location.href = '/auth/google'
}

function Login({ onAuthenticated }) {
  const [passkeyError, setPasskeyError] = useState(null)
  const [passkeyPending, setPasskeyPending] = useState(false)

  const handlePasskeySignIn = async () => {
    setPasskeyError(null)
    setPasskeyPending(true)
    try {
      await authenticateWithPasskey()
      onAuthenticated()
    } catch (err) {
      if (!isPasskeyCancellation(err)) {
        setPasskeyError('Could not sign in with that passkey — please try again')
      }
    } finally {
      setPasskeyPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:max-w-md sm:p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Gainz<span className="text-neutral-500">.Tracker</span>
          </h1>
          <p className="mt-2 text-sm text-neutral-400">Track your fitness gains</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200 active:scale-[0.98]"
          >
            <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 shrink-0">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            Sign in with Google
          </button>

          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <div className="h-px flex-1 bg-neutral-800" />
            or
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          <button
            type="button"
            onClick={handlePasskeySignIn}
            disabled={passkeyPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white disabled:opacity-60 active:scale-[0.98]"
          >
            {passkeyPending ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
          </button>

          {passkeyError ? (
            <p className="text-center text-xs text-red-400">{passkeyError}</p>
          ) : (
            <p className="text-center text-xs text-neutral-600">
              New here? Sign in with Google first to set up a passkey.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

export default Login
