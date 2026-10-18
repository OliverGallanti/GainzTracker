import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { UnauthorizedError } from './src/api'
import { AuthProvider, useAuth } from './src/auth'
import SignInScreen from './src/screens/SignInScreen'
import Tabs from './src/Tabs'
import { CACHE_MAX_AGE_MS, CACHE_VERSION, persister } from './src/offline'
import { colors } from './src/theme'

function Root() {
  const { status } = useAuth()
  if (status === 'loading') {
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
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
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
          // ponytail: writes fail straight away offline (and say so) until the
          // write queue lands; TanStack's default would leave them stuck "Saving…".
          mutations: { networkMode: 'always' },
        },
      }),
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS, buster: CACHE_VERSION }}
    >
      <AuthProvider>
        <SignOutOn401 />
        <StatusBar style="light" />
        <Root />
      </AuthProvider>
    </PersistQueryClientProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.main },
})
