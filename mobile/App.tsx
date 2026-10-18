import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UnauthorizedError } from './src/api'
import { AuthProvider, useAuth } from './src/auth'
import SignInScreen from './src/screens/SignInScreen'
import Tabs from './src/Tabs'
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
        defaultOptions: { queries: { retry: (count, error) => !(error instanceof UnauthorizedError) && count < 2 } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SignOutOn401 />
        <StatusBar style="light" />
        <Root />
      </AuthProvider>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.main },
})
