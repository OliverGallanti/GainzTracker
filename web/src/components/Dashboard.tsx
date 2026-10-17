import { useState } from 'react'
import type { Me } from '@gainz/shared/types'
import { api } from '../lib/api'
import { missingProfileFields } from '@gainz/shared/onboarding'
import { useMe } from '../lib/sharedData'
import GettingStarted from './GettingStarted'
import MacroStatsCard from './MacroStatsCard'
import WeightChart from './WeightChart'
import TrainingLogCard from './TrainingLogCard'
import BigFourCard from './BigFourCard'
import ProfileSecurityPage from './ProfileSecurityPage'
import SharedDataProvider from './SharedDataProvider'

type DashboardProps = { user: Me; onLogout: () => void }

function DashboardShell({ user, onLogout }: DashboardProps) {
  const [view, setView] = useState('dashboard') // 'dashboard' | 'profile'
  const me = useMe()

  // Tracks exactly the fields the Profile & security page itself lets you
  // set (height/goals live on their own cards) — the only things
  // "incomplete" can coherently mean here. A failed or pending load leaves
  // `me.data` undefined, which hides the badge: no error UI for a decorative hint.
  const profileIncomplete = me.data != null && missingProfileFields(me.data).length > 0

  const handleLogout = async () => {
    await api('/auth/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <div className="flex flex-1 flex-col">
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
          <div className="grid w-full max-w-sm grid-cols-1 gap-6 text-left sm:max-w-md md:max-w-3xl md:grid-cols-2 xl:max-w-7xl xl:grid-cols-3">
            <button
              type="button"
              onClick={() => setView('profile')}
              className="glow-card relative flex items-center justify-between gap-3 rounded-2xl border border-secondary/40 bg-card/90 p-4 text-left shadow-2xl shadow-black/40 backdrop-blur transition hover:border-secondary col-span-full"
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

            <GettingStarted onOpenProfile={() => setView('profile')} />
            <MacroStatsCard />
            <WeightChart />
            <TrainingLogCard />
            <BigFourCard />
          </div>
        )}
      </main>
    </div>
  )
}

function Dashboard(props: DashboardProps) {
  return (
    <SharedDataProvider>
      <DashboardShell {...props} />
    </SharedDataProvider>
  )
}

export default Dashboard
