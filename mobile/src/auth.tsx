import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin'
import { useQueryClient } from '@tanstack/react-query'
import { api, clearToken, loadToken, saveToken } from './api'
import { GOOGLE_WEB_CLIENT_ID } from './config'
import { persister } from './offline'

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID })

type Status = 'loading' | 'signedOut' | 'signedIn'

const AuthContext = createContext<{
  status: Status
  signIn: () => Promise<void>
  signOut: () => Promise<void>
} | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const queryClient = useQueryClient()

  useEffect(() => {
    loadToken().then((token) => setStatus(token ? 'signedIn' : 'signedOut'))
  }, [])

  // Native Google Sign-In -> ID token -> our Bearer token. Resolves without
  // signing in if the user dismisses the Google sheet.
  const signIn = useCallback(async () => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return // cancelled
    const { idToken } = response.data
    if (!idToken) throw new Error('Google did not return an ID token (check the web client id)')

    const { token } = await api<{ token: string }>('/auth/google/token', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    })
    await saveToken(token)
    setStatus('signedIn')
  }, [])

  // Local sign-out always succeeds; revoking on the server is best effort (the
  // token expires on its own if this call can't reach it).
  const signOut = useCallback(async () => {
    await api('/auth/token', { method: 'DELETE' }).catch(() => {})
    await GoogleSignin.signOut().catch(() => {})
    await clearToken()
    queryClient.clear()
    await persister.removeClient()
    setStatus('signedOut')
  }, [queryClient])

  return <AuthContext.Provider value={{ status, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
