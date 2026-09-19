// General-population guidance, deliberately conservative. Not medical advice, and
// the UI says so: these numbers only ever fill form fields, the user decides.

// Widely cited lower bounds for eating without supervision. Cut is never offered
// below the floor for the user's sex.
const CALORIE_FLOOR = { male: 1500, female: 1200 }
const CUT_DEFICIT = 500
const BULK_SURPLUS = 300

export const ADULT_AGE = 18

export function calorieFloor(sex) {
  return CALORIE_FLOOR[sex] ?? CALORIE_FLOOR.male
}

// The calorie presets shown next to the maintenance estimate. Under-18s get
// maintenance only: dieting and bulking advice isn't ours to give them.
export function tdeePresets(tdee, sex, age) {
  const cutCalories = Math.max(tdee - CUT_DEFICIT, calorieFloor(sex))
  const presets = [
    { key: 'cut', label: 'Cut', calories: cutCalories, available: cutCalories < tdee },
    { key: 'maintain', label: 'Maintain', calories: tdee, available: true },
    { key: 'bulk', label: 'Bulk', calories: tdee + BULK_SURPLUS, available: true },
  ]
  return age != null && age < ADULT_AGE ? presets.filter((p) => p.key === 'maintain') : presets
}

// Protein per kg of bodyweight: inside the 1.6-2.2 g/kg range usually cited for
// people who lift, at the higher end while cutting to help keep muscle.
const PROTEIN_G_PER_KG = { cut: 2.0, maintain: 1.8, bulk: 1.8 }
const FAT_SHARE_OF_CALORIES = 0.25 // within the usual 20-35%
const FAT_MIN_G_PER_KG = 0.6 // fat carries hormones and vitamins; don't squeeze it out

export const PROTEIN_RANGE_TEXT = '1.6-2.2 g per kg of bodyweight'

// Protein from bodyweight, fat as a share of calories (with a floor), carbs
// take whatever calories are left. Null when it can't be worked out. If a very
// low calorie target can't even cover protein + minimum fat, protein gives way
// (and carbs hit 0) rather than the total overshooting the target.
export function suggestMacros({ calories, weightKg, goal = 'maintain' }) {
  if (!(calories > 0) || !(weightKg > 0)) return null

  const fatG = Math.round(Math.max((calories * FAT_SHARE_OF_CALORIES) / 9, weightKg * FAT_MIN_G_PER_KG))
  let proteinG = Math.round(weightKg * (PROTEIN_G_PER_KG[goal] ?? PROTEIN_G_PER_KG.maintain))

  let carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4)
  if (carbsG < 0) {
    proteinG = Math.max(0, Math.floor((calories - fatG * 9) / 4))
    carbsG = 0
  }

  return { proteinG, fatG, carbsG, proteinPerKg: PROTEIN_G_PER_KG[goal] ?? PROTEIN_G_PER_KG.maintain }
}
