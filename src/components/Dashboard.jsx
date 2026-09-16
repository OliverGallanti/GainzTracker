import { api } from '../lib/api'

function Dashboard({ user, onLogout }) {
  const handleLogout = async () => {
    await api('/auth/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Welcome, {user.name ?? user.email}</h1>
      <p>{user.email}</p>
      <button onClick={handleLogout}>Log out</button>
    </div>
  )
}

export default Dashboard
