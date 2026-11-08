import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { AppState } from 'react-native'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

// Offline reads: every query result is saved to the phone (AsyncStorage) and
// restored on launch, so with no signal the app opens on the last data it saw.
// Queries don't fetch while offline (TanStack's default 'online' network mode)
// and refetch on their own when the connection comes back.
export const persister = createAsyncStoragePersister({ storage: AsyncStorage })

// Saved data older than this is discarded rather than shown.
export const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30

// Bump when a query's data shape changes, so an old saved cache isn't read as new.
export const CACHE_VERSION = '1'

// TanStack Query assumes it's always online on React Native; tell it the truth.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
)

// Nor does it know when the app is in front: coming back to it refetches
// whatever's on screen (the phone's "window focus").
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => setFocused(state === 'active'))
  return () => subscription.remove()
})

export function useIsOnline() {
  return useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () => onlineManager.isOnline())
}

// "today" is a calendar day, so it's part of the query key: offline the next
// morning, the saved cache must not present yesterday's meals as today's.
export const todayKey = () => ['today', new Date().toDateString()] as const
