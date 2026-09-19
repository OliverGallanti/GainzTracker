// What the calorie estimate (TDEE) and strength ratings need from the user.
// One place for it, so the profile page, the dashboard badge and the
// getting-started card can't disagree about what "complete" means.
export function missingProfileFields(me) {
  return [!me.sex && 'sex', !me.age && 'age', !me.activityLevel && 'activity level'].filter(Boolean)
}

// The two prerequisites in the order the data is needed: who you are, then your
// body. Setting targets isn't a step here: the macros card prompts for it itself.
export function onboardingSteps(me, weights) {
  const profileMissing = missingProfileFields(me)
  const bodyMissing = [!me.heightCm && 'height', weights.length === 0 && 'first weight'].filter(Boolean)

  return [
    { key: 'profile', title: 'Complete your profile', missing: profileMissing, done: profileMissing.length === 0 },
    { key: 'body', title: 'Add your height and log a weight', missing: bodyMissing, done: bodyMissing.length === 0 },
  ]
}
