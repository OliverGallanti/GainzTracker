import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { isPasskeyCancellation, registerPasskey } from '../lib/webauthn'
import MacroStatsCard from './MacroStatsCard'
import WeightChart from './WeightChart'
import GymStreak from './GymStreak'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function Dashboard({ user, onLogout }) {
  const [passkeys, setPasskeys] = useState(null)
  const [passkeyPending, setPasskeyPending] = useState(false)
  const [passkeyError, setPasskeyError] = useState(null)

  const loadPasskeys = () => {
    api('/api/passkeys')
      .then(setPasskeys)
      .catch(() => setPasskeys([]))
  }

  useEffect(() => {
    loadPasskeys()
  }, [])

  const handleLogout = async () => {
    await api('/auth/logout', { method: 'POST' })
    onLogout()
  }

  const handleAddPasskey = async () => {
    setPasskeyError(null)
    setPasskeyPending(true)
    try {
      await registerPasskey()
      loadPasskeys()
    } catch (err) {
      if (!isPasskeyCancellation(err)) {
        setPasskeyError('Could not add that passkey — please try again')
      }
    } finally {
      setPasskeyPending(false)
    }
  }

  const handleRemovePasskey = async (id) => {
    await api(`/api/passkeys/${id}`, { method: 'DELETE' })
    loadPasskeys()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-4 sm:px-6">
        <span className="text-lg font-bold tracking-tight text-white">
          Gainz<span className="text-neutral-500">.Tracker</span>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white active:scale-[0.98]"
        >
          Log out
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-12 sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-6 text-center sm:max-w-md md:max-w-2xl">
          <MacroStatsCard />

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                className="mx-auto mb-4 h-16 w-16 rounded-full border border-neutral-700"
              />
            )}
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              Welcome, {user.name ?? user.email}
            </h1>
            <p className="mt-1 text-sm text-neutral-400">{user.email}</p>
          </div>

          <WeightChart />
          <GymStreak />

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
            <h2 className="text-sm font-semibold text-white">Passkeys</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Sign in without Google using your device's fingerprint, face, or PIN.
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {passkeys === null && <li className="text-xs text-neutral-500">Loading…</li>}
              {passkeys?.length === 0 && (
                <li className="text-xs text-neutral-500">No passkeys registered yet.</li>
              )}
              {passkeys?.map((passkey) => (
                <li
                  key={passkey.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="text-neutral-200">{passkey.deviceLabel ?? 'Passkey'}</p>
                    <p className="text-xs text-neutral-500">Added {formatDate(passkey.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePasskey(passkey.id)}
                    className="text-xs font-medium text-neutral-400 transition hover:text-red-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleAddPasskey}
              disabled={passkeyPending}
              className="mt-4 w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white disabled:opacity-60 active:scale-[0.98]"
            >
              {passkeyPending ? 'Waiting for your passkey…' : 'Add a passkey'}
            </button>

            {passkeyError && <p className="mt-2 text-center text-xs text-red-400">{passkeyError}</p>}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
