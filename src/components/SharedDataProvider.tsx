import type { ReactNode } from 'react'
import { api } from '../lib/api'
import { SharedDataContext } from '../lib/sharedData'
import { useLoad } from '../lib/useLoad'

function SharedDataProvider({ children }: { children: ReactNode }) {
  const me = useLoad(() => api('/api/me'))
  const weights = useLoad(() => api('/api/weights'))

  return <SharedDataContext.Provider value={{ me, weights }}>{children}</SharedDataContext.Provider>
}

export default SharedDataProvider
