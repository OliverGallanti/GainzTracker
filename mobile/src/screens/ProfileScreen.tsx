import { useState } from 'react'
import { View } from 'react-native'
import { missingProfileFields } from '@gainz/shared/onboarding'
import { ACTIVITY_LEVELS } from '@gainz/shared/tdee'
import type { Me, Sex } from '@gainz/shared/types'
import { useAuth } from '../auth'
import { useMe } from '../queries'
import { QUEUED, useQueued, type UpdateMeVars } from '../queue'
import { Text, Button, Card, Chip, ErrorText, Field, Muted, Screen, styles as ui } from '../ui'

const text = (value: number | null | undefined) => (value == null ? '' : String(value))

export default function ProfileScreen() {
  const { signOut } = useAuth()
  const me = useMe()

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
      </Card>
    </Screen>
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
