import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { isPasskeyCancellation, registerPasskey } from '../lib/webauthn'
import { ACTIVITY_LEVELS } from '../lib/tdee'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Passkey management lives here, not on the dashboard — adding a new sign-in
// credential is a security-sensitive action that shouldn't sit one tap away
// on the page you land on every visit.
function ProfileSecurityPage({ user, onBack }) {
  const [passkeys, setPasskeys] = useState(null)
  const [passkeyPending, setPasskeyPending] = useState(false)
  const [passkeyError, setPasskeyError] = useState(null)

  const [sex, setSex] = useState(undefined) // undefined = loading, null = unset
  const [savingSex, setSavingSex] = useState(false)

  const [age, setAge] = useState(undefined) // undefined = loading, null = unset
  const [ageDraft, setAgeDraft] = useState('')
  const [savingAge, setSavingAge] = useState(false)

  const [activityLevel, setActivityLevel] = useState(undefined)
  const [savingActivity, setSavingActivity] = useState(false)

  const loadPasskeys = () => {
    api('/api/passkeys')
      .then(setPasskeys)
      .catch(() => setPasskeys([]))
  }

  useEffect(() => {
    loadPasskeys()
    api('/api/me').then((me) => {
      setSex(me.sex ?? null)
      setAge(me.age ?? null)
      setAgeDraft(me.age ?? '')
      setActivityLevel(me.activityLevel ?? null)
    })
  }, [])

  const handleSaveSex = async (value) => {
    setSavingSex(true)
    try {
      await api('/api/me', { method: 'PUT', body: JSON.stringify({ sex: value }) })
      setSex(value)
    } finally {
      setSavingSex(false)
    }
  }

  const handleSaveAge = async (e) => {
    e.preventDefault()
    setSavingAge(true)
    try {
      await api('/api/me', { method: 'PUT', body: JSON.stringify({ age: Number(ageDraft) }) })
      setAge(Number(ageDraft))
    } finally {
      setSavingAge(false)
    }
  }

  const handleSaveActivity = async (value) => {
    setSavingActivity(true)
    try {
      await api('/api/me', { method: 'PUT', body: JSON.stringify({ activityLevel: value }) })
      setActivityLevel(value)
    } finally {
      setSavingActivity(false)
    }
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
    <div className="flex w-full max-w-sm flex-col gap-6 sm:max-w-md md:max-w-2xl">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-xs font-medium text-third/60 transition hover:text-third"
      >
        ← Back to dashboard
      </button>

      <div className="rounded-2xl border border-secondary/40 bg-card/90 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
        {user.avatarUrl && (
          <img
            src={user.avatarUrl}
            alt=""
            className="mx-auto mb-4 h-16 w-16 rounded-full border border-secondary/40"
          />
        )}
        <h1 className="text-xl font-semibold text-third sm:text-2xl">{user.name ?? user.email}</h1>
        <p className="mt-1 text-sm text-third/60">{user.email}</p>
      </div>

      <div className="rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
        <h2 className="text-sm font-semibold text-third">Profile details</h2>
        <p className="mt-1 text-xs text-third/60">
          Optional - powers the Big 4 strength-level rating and the TDEE calorie estimate, nothing else
          depends on it.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-third/60">Sex</span>
          {['male', 'female'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSaveSex(value)}
              disabled={savingSex}
              className={`rounded-md px-3 py-1 text-xs font-medium transition disabled:opacity-60 ${
                sex === value ? 'bg-third text-main' : 'text-third/60 hover:text-third'
              }`}
            >
              {value === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSaveAge} className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-third/60">Age</span>
          <input
            type="number"
            min="10"
            max="120"
            step="1"
            value={ageDraft}
            onChange={(e) => setAgeDraft(e.target.value)}
            className="w-16 rounded-md border border-secondary/40 bg-main px-2 py-1 text-third outline-none focus:border-secondary"
          />
          <button
            type="submit"
            disabled={savingAge || !ageDraft || Number(ageDraft) === age}
            className="text-third underline decoration-secondary/40 underline-offset-2 hover:decoration-secondary disabled:opacity-40"
          >
            Save
          </button>
        </form>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="shrink-0 text-third/60">Activity</span>
          <select
            value={activityLevel ?? ''}
            onChange={(e) => handleSaveActivity(e.target.value)}
            disabled={savingActivity}
            className="w-full rounded-md border border-secondary/40 bg-main px-2 py-1 text-third outline-none focus:border-secondary disabled:opacity-60"
          >
            <option value="" disabled>
              Select…
            </option>
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level.key} value={level.key}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
        <h2 className="text-sm font-semibold text-third">Passkeys</h2>
        <p className="mt-1 text-xs text-third/60">
          Sign in without Google using your device's fingerprint, face, or PIN.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {passkeys === null && <li className="text-xs text-third/60">Loading…</li>}
          {passkeys?.length === 0 && (
            <li className="text-xs text-third/60">No passkeys registered yet.</li>
          )}
          {passkeys?.map((passkey) => (
            <li
              key={passkey.id}
              className="flex items-center justify-between rounded-lg border border-secondary/25 px-3 py-2 text-sm"
            >
              <div>
                <p className="text-third">{passkey.deviceLabel ?? 'Passkey'}</p>
                <p className="text-xs text-third/60">Added {formatDate(passkey.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemovePasskey(passkey.id)}
                className="text-xs font-medium text-third/60 transition hover:text-red-400"
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
          className="mt-4 w-full rounded-lg border border-secondary/40 px-4 py-2.5 text-sm font-medium text-third transition hover:border-secondary disabled:opacity-60 active:scale-[0.98]"
        >
          {passkeyPending ? 'Waiting for your passkey…' : 'Add a passkey'}
        </button>

        {passkeyError && <p className="mt-2 text-center text-xs text-red-400">{passkeyError}</p>}
      </div>
    </div>
  )
}

export default ProfileSecurityPage
