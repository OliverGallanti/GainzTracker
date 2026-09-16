import { useCallback, useEffect, useState } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

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

  return (
    <div className="app-background min-h-dvh">
      {authStatus === 'authed' && (
        <Dashboard user={user} onLogout={() => setAuthStatus('anon')} />
      )}
      {authStatus === 'anon' && <Login onAuthenticated={checkAuth} />}
    </div>
  )
}

export default App
