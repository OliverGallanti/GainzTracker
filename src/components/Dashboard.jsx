import { useState } from 'react'
import { api } from '../lib/api'
import { useMe } from '../lib/sharedData'
import MacroStatsCard from './MacroStatsCard'
import WeightChart from './WeightChart'
import RoutineCard from './RoutineCard'
import TrainingLogCard from './TrainingLogCard'
import BigFourCard from './BigFourCard'
import ProfileSecurityPage from './ProfileSecurityPage'
import SharedDataProvider from './SharedDataProvider'

function DashboardShell({ user, onLogout }) {
  const [splitVersion, setSplitVersion] = useState(0)
  const [view, setView] = useState('dashboard') // 'dashboard' | 'profile'
  const me = useMe()

  // Tracks exactly the fields the Profile & security page itself lets you
  // set (height/goals live on their own cards) — the only things
  // "incomplete" can coherently mean here. A failed or pending load leaves
  // `me.data` undefined, which hides the badge: no error UI for a decorative hint.
  const profileIncomplete = me.data != null && (!me.data.sex || !me.data.age || !me.data.activityLevel)

  const handleLogout = async () => {
    await api('/auth/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-secondary/40 bg-card/90 px-4 py-4 backdrop-blur sm:px-6">
        <span className="text-lg font-bold tracking-tight text-third">
          Gainz<span className="text-third/60">.Tracker</span>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-secondary/40 px-3 py-1.5 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
        >
          Log out
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-12 sm:px-6">
        {view === 'profile' ? (
          <ProfileSecurityPage user={user} onBack={() => setView('dashboard')} />
        ) : (
          <div className="grid w-full max-w-sm grid-cols-1 gap-6 text-left sm:max-w-md md:max-w-2xl lg:max-w-5xl lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setView('profile')}
              className="relative flex items-center justify-between gap-3 rounded-2xl border border-secondary/40 bg-card/90 p-4 text-left shadow-2xl shadow-black/40 backdrop-blur transition hover:border-secondary lg:col-span-2"
            >
              {profileIncomplete && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5" title="Your profile isn't complete yet">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-amber-400" />
                </span>
              )}
              <div className="flex items-center gap-3">
                {user.avatarUrl && (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full border border-secondary/40"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-third">{user.name ?? user.email}</p>
                  <p className="text-xs text-third/60">{user.email}</p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-third/60">Profile &amp; security →</span>
            </button>

            <MacroStatsCard />
            <WeightChart />
            <RoutineCard onSplitChanged={() => setSplitVersion((v) => v + 1)} />
            <TrainingLogCard refreshKey={splitVersion} />
            <BigFourCard />
          </div>
        )}
      </main>
    </div>
  )
}

function Dashboard(props) {
  return (
    <SharedDataProvider>
      <DashboardShell {...props} />
    </SharedDataProvider>
  )
}

export default Dashboard
