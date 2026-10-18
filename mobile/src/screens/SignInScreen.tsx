import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../auth'
import { colors } from '../theme'

export default function SignInScreen() {
  const { signIn } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setPending(true)
    setError(null)
    try {
      await signIn()
    } catch (err) {
      // Dev builds show the real cause (e.g. Google's DEVELOPER_ERROR when the
      // Android OAuth client or its SHA-1 is missing); release builds stay generic.
      const detail = err instanceof Error ? `${(err as { code?: string }).code ?? ''} ${err.message}`.trim() : String(err)
      setError(__DEV__ ? `Could not sign in: ${detail}` : 'Could not sign in: please try again')
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>
        Gainz<Text style={styles.titleMuted}>.Tracker</Text>
      </Text>
      <Text style={styles.subtitle}>Track your macros, weight and training.</Text>

      <Pressable
        onPress={handleSignIn}
        disabled={pending}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, (pressed || pending) && styles.buttonPressed]}
      >
        {pending ? <ActivityIndicator color={colors.main} /> : <Text style={styles.buttonText}>Sign in with Google</Text>}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.main },
  title: { fontSize: 32, fontWeight: '700', color: colors.text },
  titleMuted: { color: colors.muted },
  subtitle: { marginTop: 8, marginBottom: 32, color: colors.muted },
  button: {
    minHeight: 48,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.text,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { fontSize: 16, fontWeight: '600', color: colors.main },
  error: { marginTop: 16, color: colors.danger },
})
