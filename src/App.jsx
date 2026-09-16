import { useEffect, useState } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

function App() {
  const [authStatus, setAuthStatus] = useState('loading')
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
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

  if (authStatus === 'loading') {
    return null
  }

  if (authStatus === 'authed') {
    return <Dashboard user={user} onLogout={() => setAuthStatus('anon')} />
  }

  return <Login />
}

export default App
