import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryCache, QueryClient, useIsRestoring } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { UnauthorizedError } from './src/api'
import { AuthProvider, useAuth } from './src/auth'
import SignInScreen from './src/screens/SignInScreen'
import Tabs from './src/Tabs'
import { CACHE_MAX_AGE_MS, CACHE_VERSION, persister } from './src/offline'
import { reapplyQueuedWrites, registerQueuedMutations, shouldSaveMutation } from './src/queue'
import { colors } from './src/theme'

function Root() {
  const { status } = useAuth()
  // Screens wait for the saved data (milliseconds, it's on the phone) so they
  // open on it instead of finding the cache empty.
  const restoring = useIsRestoring()
  if (status === 'loading' || restoring) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    )
  }
  return status === 'signedIn' ? <Tabs /> : <SignInScreen />
}

// A rejected token anywhere (expired or revoked) signs the user out, so no screen
// has to handle it. Bridged through a ref-like holder because the QueryClient
// is created before the AuthProvider that knows how to sign out.
const onUnauthorizedRef = { current: () => {} }

function SignOutOn401() {
  const { signOut } = useAuth()
  useEffect(() => {
    onUnauthorizedRef.current = signOut
  }, [signOut])
  return null
}

export default function App() {
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
        queryCache: new QueryCache({
          onSuccess: () => reapplyQueuedWrites(client),
          onError: (error) => {
            if (error instanceof UnauthorizedError) onUnauthorizedRef.current()
          },
        }),
        defaultOptions: {
          queries: {
            retry: (count, error) => !(error instanceof UnauthorizedError) && count < 2,
            // Kept in memory as long as it's kept on disk, or it would be dropped
            // before it could be saved/restored.
            gcTime: CACHE_MAX_AGE_MS,
          },
          // Writes that aren't queued (targets, removes) fail straight away offline
          // and say so; queued ones override this (see queue.ts).
          mutations: { networkMode: 'always' },
        },
      })
    registerQueuedMutations(client)
    return client
  })

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE_MS,
        buster: CACHE_VERSION,
        dehydrateOptions: { shouldDehydrateMutation: shouldSaveMutation },
      }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <SafeAreaProvider>
        <AuthProvider>
          <SignOutOn401 />
          <StatusBar style="light" />
          <Root />
        </AuthProvider>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.main },
})
