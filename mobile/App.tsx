import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
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

// Outside any component, so it runs before the system splash can go away.
void SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions({ duration: 0 }) // its default fade would cover the start of AnimatedSplash

function Root() {
  const { status } = useAuth()
  // Screens wait for the saved data (milliseconds, it's on the phone) so they
  // open on it instead of finding the cache empty.
  const restoring = useIsRestoring()
  const loading = status === 'loading' || restoring
  const [splashDone, setSplashDone] = useState(false)

  return (
    <View style={styles.root}>
      {!loading && (status === 'signedIn' ? <Tabs /> : <SignInScreen />)}
      {!splashDone && <AnimatedSplash ready={!loading} onDone={setSplashDone} />}
    </View>
  )
}

// Android's own splash can only be a still image, so this takes over from it:
// the same logo at the same size and place (imageWidth in app.json), then a
// short scale-up and fade into the app. It only waits for what's on the phone.
const SPLASH_SIZE = 288

function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: (done: boolean) => void }) {
  const [progress] = useState(() => new Animated.Value(0))
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    if (!ready || !drawn) return
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) onDone(true)
      else Animated.timing(progress, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => onDone(true))
    })
  }, [ready, drawn, progress, onDone])

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.splash, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      <Animated.Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- how React Native loads a bundled image
        source={require('./assets/android-icon-foreground.png')}
        onLoadEnd={() => {
          setDrawn(true)
          void SplashScreen.hideAsync()
        }}
        style={{
          width: SPLASH_SIZE,
          height: SPLASH_SIZE,
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }],
        }}
      />
    </Animated.View>
  )
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
  root: { flex: 1, backgroundColor: colors.main },
  splash: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.main },
})
