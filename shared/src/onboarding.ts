// What the calorie estimate (TDEE) and strength ratings need from the user.
// One place for it, so the profile page, the dashboard badge and the
// getting-started card can't disagree about what "complete" means.
import type { Me } from './types'

type ProfileFields = Pick<Me, 'sex' | 'age' | 'activityLevel'>

const present = (items: (string | false)[]) => items.filter((x): x is string => Boolean(x))

export function missingProfileFields(me: ProfileFields) {
  return present([!me.sex && 'sex', !me.age && 'age', !me.activityLevel && 'activity level'])
}

// The two prerequisites in the order the data is needed: who you are, then your
// body. Setting targets isn't a step here: the macros card prompts for it itself.
export function onboardingSteps(me: ProfileFields & Pick<Me, 'heightCm'>, weights: unknown[]) {
  const profileMissing = missingProfileFields(me)
  const bodyMissing = present([!me.heightCm && 'height', weights.length === 0 && 'first weight'])

  return [
    { key: 'profile', title: 'Complete your profile', missing: profileMissing, done: profileMissing.length === 0 },
    { key: 'body', title: 'Add your height and log a weight', missing: bodyMissing, done: bodyMissing.length === 0 },
  ]
}
