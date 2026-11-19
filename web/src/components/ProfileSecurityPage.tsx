import { useState } from 'react'
import type { Me, Passkey } from '@gainz/shared/types'
import { api } from '../lib/api'
import { missingProfileFields } from '@gainz/shared/onboarding'
import { useMe } from '../lib/sharedData'
import { ACTIVITY_LEVELS } from '@gainz/shared/tdee'
import { useLoad } from '../lib/useLoad'
import { useSubmit } from '../lib/useSubmit'
import { isPasskeyCancellation, registerPasskey } from '../lib/webauthn'

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Passkey management lives here, not on the dashboard — adding a new sign-in
// credential is a security-sensitive action that shouldn't sit one tap away
// on the page you land on every visit.
function ProfileSecurityPage({ user, onBack, onDeleted }: { user: Me; onBack: () => void; onDeleted: () => void }) {
  // Profile fields come from the shared /api/me resource; saving one reloads it
  // so the dashboard's completeness badge and every card reading the profile
  // update too, with no plumbing back up the tree.
  const me = useMe()
  const sex = me.data ? me.data.sex ?? null : undefined // null = unset, undefined = loading
  const age = me.data?.age ?? null
  const activityLevel = me.data?.activityLevel ?? null

  // Null until the user types; until then the input shows the saved age.
  const [ageDraft, setAgeDraft] = useState<string | null>(null)
  const ageValue = ageDraft ?? age ?? ''

  const saveProfile = (fields: Partial<Me>) =>
    api('/api/me', { method: 'PUT', body: JSON.stringify(fields) }).then(me.reload)

  const sexSubmit = useSubmit((value) => saveProfile({ sex: value }), 'Could not save your sex')
  const ageSubmit = useSubmit(
    () => saveProfile({ age: Number(ageValue) }),
    'Could not save your age',
  )
  const activitySubmit = useSubmit(
    (value) => saveProfile({ activityLevel: value }),
    'Could not save your activity level',
  )
  const profileSaveError = sexSubmit.error ?? ageSubmit.error ?? activitySubmit.error

  // What's still blank. Only meaningful once the profile has loaded.
  const missing = me.data ? missingProfileFields(me.data) : []
  const ageChanged = Boolean(ageValue) && Number(ageValue) !== age

  // A failed load is kept distinct from an empty list on purpose — "no passkeys
  // registered" and "we couldn't check" mean very different things on a
  // security screen.
  const passkeys = useLoad(['passkeys'], () => api<Passkey[]>('/api/passkeys'))

  const {
    submit: handleAddPasskey,
    saving: passkeyPending,
    error: passkeyError,
  } = useSubmit(async () => {
    try {
      await registerPasskey()
    } catch (err) {
      // Dismissing the browser prompt isn't a failure worth reporting.
      if (isPasskeyCancellation(err)) return
      throw err
    }
    passkeys.reload()
  }, 'Could not add that passkey: please try again')

  const handleRemovePasskey = async (id: string) => {
    await api(`/api/passkeys/${id}`, { method: 'DELETE' })
    passkeys.reload()
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

      <div className="glow-card rounded-2xl border border-secondary/40 bg-card/90 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
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

      <div className="glow-card rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
        <h2 className="card-title">Profile details</h2>
        <p className="mt-1 text-xs text-third/60">
          Powers the Big 4 strength-level rating and the TDEE calorie estimate. Nothing else depends on it.
        </p>

        {missing.length > 0 && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-300"
          >
            Missing info: {missing.join(', ')}. Without it the calorie estimate and strength ratings can't be
            calculated.
          </p>
        )}

        {me.error && (
          <p className="mt-2 text-xs text-red-400">
            Could not load your profile details:{' '}
            <button type="button" onClick={me.reload} className="underline hover:no-underline">
              retry
            </button>
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-third/60">Sex</span>
          {['male', 'female'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => sexSubmit.submit(value)}
              disabled={sexSubmit.saving}
              className={`rounded-md px-3 py-1 text-xs font-medium transition disabled:opacity-60 ${
                sex === value ? 'bg-third text-main' : 'text-third/60 hover:text-third'
              }`}
            >
              {value === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>

        <form onSubmit={ageSubmit.submit} className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-third/60">Age</span>
          <input
            type="number"
            min="10"
            max="120"
            step="1"
            value={ageValue}
            onChange={(e) => setAgeDraft(e.target.value)}
            className="w-20 rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-sm text-third outline-none focus:border-secondary"
          />
          {/* Filled while there's something to save, outlined once it's saved. */}
          <button
            type="submit"
            disabled={ageSubmit.saving || !ageChanged}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition disabled:opacity-50 active:scale-[0.98] ${
              ageChanged
                ? 'bg-third text-main hover:bg-third/90'
                : 'border border-secondary/40 text-third/60'
            }`}
          >
            {ageSubmit.saving ? 'Saving…' : ageChanged ? 'Save age' : 'Saved'}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="shrink-0 text-third/60">Activity</span>
          <select
            value={activityLevel ?? ''}
            onChange={(e) => activitySubmit.submit(e.target.value)}
            disabled={activitySubmit.saving}
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

        {profileSaveError && (
          <p className="mt-2 text-xs text-red-400">{profileSaveError}: please try again</p>
        )}
      </div>

      <div className="glow-card rounded-2xl border border-secondary/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
        <h2 className="card-title">Passkeys</h2>
        <p className="mt-1 text-xs text-third/60">
          Sign in without Google using your device's fingerprint, face, or PIN.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {passkeys.data === undefined && !passkeys.error && (
            <li className="text-xs text-third/60">Loading…</li>
          )}
          {passkeys.error && (
            <li className="text-xs text-red-400">
              Could not load your passkeys:{' '}
              <button type="button" onClick={passkeys.reload} className="underline hover:no-underline">
                retry
              </button>
            </li>
          )}
          {passkeys.data?.length === 0 && (
            <li className="text-xs text-third/60">No passkeys registered yet.</li>
          )}
          {passkeys.data?.map((passkey) => (
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

      <DeleteAccountCard onDeleted={onDeleted} />
    </div>
  )
}

// Erases the account and everything in it on the server (the session too),
// then returns to the sign-in screen.
function DeleteAccountCard({ onDeleted }: { onDeleted: () => void }) {
  const [typed, setTyped] = useState('')
  const { submit, saving, error } = useSubmit(async () => {
    await api('/api/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) })
    onDeleted()
  }, 'Could not delete your account: please try again')

  return (
    <form
      onSubmit={submit}
      className="glow-card rounded-2xl border border-red-400/40 bg-card/90 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8"
    >
      <h2 className="card-title">Delete account</h2>
      <p className="mt-1 text-xs text-third/60">
        This erases your account and everything in it: profile, foods, weights, routines, training and passkeys, on
        the website and the phone. <span className="font-medium text-third">It happens at once and can't be undone.</span>
      </p>
      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-third">Type DELETE to confirm</span>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-third outline-none focus:border-secondary"
        />
      </label>
      <button
        type="submit"
        disabled={typed !== 'DELETE' || saving}
        className="mt-4 w-full rounded-lg bg-red-400 px-4 py-2.5 text-sm font-medium text-main transition hover:bg-red-400/90 disabled:opacity-40 active:scale-[0.98]"
      >
        {saving ? 'Deleting…' : 'Delete my account'}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}
    </form>
  )
}

export default ProfileSecurityPage
