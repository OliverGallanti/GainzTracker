import { useState } from 'react'
import { Linking, View } from 'react-native'
import * as Updates from 'expo-updates'
import { APP_VERSION, AUTHOR, AUTHOR_LINKS, FOOD_DATA_CREDITS, SERVER_CREDITS } from '@gainz/shared/about'
import { missingProfileFields } from '@gainz/shared/onboarding'
import { ACTIVITY_LEVELS } from '@gainz/shared/tdee'
import type { Me, Sex } from '@gainz/shared/types'
import { useAuth } from '../auth'
import { useMe } from '../queries'
import { QUEUED, useQueued, type UpdateMeVars } from '../queue'
import { Text, Button, Card, Chip, ErrorText, Field, Muted, Screen, Sheet, styles as ui } from '../ui'

const text = (value: number | null | undefined) => (value == null ? '' : String(value))

export default function ProfileScreen() {
  const { signOut } = useAuth()
  const me = useMe()
  const [deleting, setDeleting] = useState(false)

  return (
    <Screen>
      <Card title="Profile">
        {me.isPending && <Muted>Loading…</Muted>}
        {me.isLoadingError && <ErrorText onPress={() => void me.refetch()}>Could not load your profile: tap to retry</ErrorText>}
        {me.data && <ProfileForm me={me.data} />}
      </Card>

      <Card title="Account">
        {me.data && <Muted>Signed in as {me.data.email}</Muted>}
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        <Button label="Delete account" variant="small" onPress={() => setDeleting(true)} />
      </Card>

      <Sheet visible={deleting} title="Delete account" onClose={() => setDeleting(false)}>
        <DeleteAccount />
      </Sheet>

      <About />
    </Screen>
  )
}

// Erases the account and everything in it on the server, then signs out.
function DeleteAccount() {
  const { deleteAccount } = useAuth()
  const [typed, setTyped] = useState('')
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)

  const confirm = async () => {
    setSending(true)
    setFailed(false)
    try {
      await deleteAccount() // signs out on success, which closes this screen
    } catch {
      setFailed(true)
      setSending(false)
    }
  }

  return (
    <Card>
      <Text>This erases your account and everything in it: profile, foods, weights, routines, training and passkeys, on the phone and the website.</Text>
      <Text style={{ fontWeight: '600' }}>It happens at once and can't be undone.</Text>
      <Muted>You need a connection for this.</Muted>
      <Field label="Type DELETE to confirm" value={typed} onChange={setTyped} autoCapitalize="characters" autoCorrect={false} />
      <Button label={sending ? 'Deleting…' : 'Delete my account'} variant="danger" disabled={typed !== 'DELETE' || sending} onPress={() => void confirm()} />
      {failed && <ErrorText>Could not delete your account: check your connection and try again</ErrorText>}
    </Card>
  )
}

const APP_CREDITS = [
  { name: 'React Native', url: 'https://reactnative.dev' },
  { name: 'Expo', url: 'https://expo.dev' },
  { name: 'TanStack Query', url: 'https://tanstack.com/query' },
  { name: 'Lucide', url: 'https://lucide.dev', note: 'icons' },
  { name: 'Manrope', url: 'https://fonts.google.com/specimen/Manrope', note: 'typeface' },
]
const CREDITS = [
  { title: 'Food data', items: FOOD_DATA_CREDITS },
  { title: 'App', items: APP_CREDITS },
  { title: 'Server', items: SERVER_CREDITS },
]

// Which code this phone is running: the release, and the over-the-air update on
// top of the installed app (or none: the code the app was built with). Checking
// downloads a waiting update and restarts into it, instead of waiting for the
// next two launches.
function About() {
  const [status, setStatus] = useState<string | null>(null)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const running = !Updates.isEnabled
    ? 'Development build: updates are off'
    : Updates.isEmbeddedLaunch || !Updates.createdAt
      ? 'Running the code the app was installed with'
      : `Update from ${Updates.createdAt.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`

  const check = async () => {
    try {
      setStatus('Checking…')
      const { isAvailable } = await Updates.checkForUpdateAsync()
      if (!isAvailable) return setStatus('You have the latest version.')
      setStatus('Downloading the update…')
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync()
    } catch {
      setStatus('Could not check for updates: are you online?')
    }
  }

  return (
    <Card title="About">
      <Text style={ui.text}>
        Gainz.Tracker v{APP_VERSION} · Made by {AUTHOR}
      </Text>
      <Muted>{running}</Muted>
      {Updates.updateId && (
        <Muted>
          Update {Updates.updateId.slice(0, 8)} · {Updates.channel ?? 'no channel'} · runtime {Updates.runtimeVersion?.slice(0, 7)}
        </Muted>
      )}
      {Updates.isEnabled && <Button label="Check for updates" variant="secondary" onPress={() => void check()} />}
      {status && <Muted>{status}</Muted>}
      <View style={ui.chips}>
        {AUTHOR_LINKS.map((link) => (
          <Button key={link.name} label={link.name} variant="small" onPress={() => void Linking.openURL(link.url)} />
        ))}
        <Button label="Credits" variant="small" onPress={() => setCreditsOpen(true)} />
      </View>

      <Sheet visible={creditsOpen} title="Credits" onClose={() => setCreditsOpen(false)}>
        <Muted>Made by {AUTHOR}, standing on a lot of open-source work.</Muted>
        {CREDITS.map((group) => (
          <View key={group.title} style={{ gap: 6 }}>
            <Text style={[ui.text, { fontWeight: '600' }]} accessibilityRole="header">
              {group.title}
            </Text>
            {group.items.map((item) => (
              <Text key={item.name} style={ui.muted}>
                <Text style={[ui.text, { textDecorationLine: 'underline' }]} accessibilityRole="link" onPress={() => void Linking.openURL(item.url)}>
                  {item.name}
                </Text>
                {'note' in item && item.note ? ` - ${item.note}` : ''}
              </Text>
            ))}
          </View>
        ))}
      </Sheet>
    </Card>
  )
}

// Queued like every other write (see queue.ts), so it works offline too. Only
// fields that changed are sent; a field can be changed but not cleared, as on the web.
function ProfileForm({ me }: { me: Me }) {
  const update = useQueued<UpdateMeVars>(QUEUED.updateMe)
  const [sex, setSex] = useState<Sex | null>(me.sex)
  const [activityLevel, setActivityLevel] = useState(me.activityLevel)
  const [form, setForm] = useState({
    age: text(me.age),
    heightCm: text(me.heightCm),
    weightGoalKg: text(me.weightGoalKg),
    bodyFatGoalPercent: text(me.bodyFatGoalPercent),
  })
  const [saved, setSaved] = useState(false)

  const age = form.age === '' ? null : Number(form.age)
  const invalid =
    (age != null && !(Number.isInteger(age) && age >= 10 && age <= 120)) ||
    (form.heightCm !== '' && !(Number(form.heightCm) > 0)) ||
    (form.weightGoalKg !== '' && !(Number(form.weightGoalKg) > 0)) ||
    (form.bodyFatGoalPercent !== '' && !(Number(form.bodyFatGoalPercent) >= 0 && Number(form.bodyFatGoalPercent) <= 100))

  const changes: UpdateMeVars['changes'] = {}
  if (sex && sex !== me.sex) changes.sex = sex
  if (activityLevel && activityLevel !== me.activityLevel) changes.activityLevel = activityLevel
  for (const key of ['age', 'heightCm', 'weightGoalKg', 'bodyFatGoalPercent'] as const) {
    if (form[key] !== '' && Number(form[key]) !== me[key]) changes[key] = Number(form[key])
  }
  const hasChanges = Object.keys(changes).length > 0

  const save = () => {
    update.mutate({ label: 'Profile', changes })
    setSaved(true)
  }

  // What's still blank, after this form's unsaved edits.
  const missing = missingProfileFields({ sex, age, activityLevel })

  return (
    <View style={{ gap: 12 }}>
      <Muted>Used for your calorie estimate, macro suggestions and strength ratings.</Muted>
      {missing.length > 0 && <Text style={{ color: '#fcd34d' }}>Missing: {missing.join(', ')}</Text>}

      <Text style={ui.label}>Sex</Text>
      <View style={ui.chips}>
        {(['male', 'female'] as const).map((value) => (
          <Chip key={value} label={value === 'male' ? 'Male' : 'Female'} selected={sex === value} onPress={() => setSex(value)} />
        ))}
      </View>

      <Text style={ui.label}>Activity level</Text>
      <View style={{ gap: 8 }}>
        {ACTIVITY_LEVELS.map((level) => (
          <Chip key={level.key} label={level.label} selected={activityLevel === level.key} onPress={() => setActivityLevel(level.key)} />
        ))}
      </View>

      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        <Field label="Age" value={form.age} onChange={(v) => setForm({ ...form, age: v.replace(/\D/g, '') })} keyboardType="number-pad" />
        <Field label="Height (cm)" value={form.heightCm} onChange={(v) => setForm({ ...form, heightCm: v })} numeric />
        <Field label="Weight goal (kg)" value={form.weightGoalKg} onChange={(v) => setForm({ ...form, weightGoalKg: v })} numeric />
        <Field
          label="Body fat goal (%)"
          value={form.bodyFatGoalPercent}
          onChange={(v) => setForm({ ...form, bodyFatGoalPercent: v })}
          numeric
        />
      </View>

      {invalid && <ErrorText>Age is 10 to 120, body fat 0 to 100, and the rest must be above 0.</ErrorText>}
      <Button label="Save profile" onPress={save} disabled={!hasChanges || invalid} />
      {saved && !hasChanges && <Muted>Saved.</Muted>}
    </View>
  )
}
