import { useCallback, useEffect, useState } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Footer from './components/Footer'

function App() {
  const [authStatus, setAuthStatus] = useState('loading')
  const [user, setUser] = useState(null)

  const checkAuth = useCallback(() => {
    return fetch('/api/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Not authenticated')
      })
      .then((data) => {
        setUser(data)
        setAuthStatus('authed')
      })
      .catch(() => {
        setAuthStatus('anon')
      })
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Feeds the cursor position, relative to each card, to the .glow-card CSS.
  useEffect(() => {
    const onMove = (e) => {
      for (const card of document.querySelectorAll('.glow-card')) {
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
      }
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="app-background flex min-h-dvh flex-col">
      {authStatus === 'authed' && (
        <Dashboard user={user} onLogout={() => setAuthStatus('anon')} />
      )}
      {authStatus === 'anon' && <Login onAuthenticated={checkAuth} />}
      <Footer />
    </div>
  )
}

export default App
