import { amountFactor, basisLabel, foodUnits, formatMacro, scaleFood, type FoodBasis } from './macros.ts'
import type { AmountUnit, Meal, Product, SavedFood } from './types'

// Logging a food, the same on web and mobile: a food from any source (a saved
// food, Open Food Facts, typed in, or a food already logged) becomes a
// FoodDraft, its values per one serving or per 100 g; an amount in grams or
// servings turns it into what was eaten.

export type FoodDraft = FoodBasis & {
  name: string
  calories: number | null
  proteinG: number | null
  fatG: number | null
  carbsG: number | null
  savedId?: string // from My foods
  barcode?: string // from Open Food Facts (for the credit link)
  brand?: string | null
  servingSize?: string | null // the label's own text, e.g. "30 g"
}

export const EMPTY_FOOD: FoodDraft = { name: '', calories: null, proteinG: null, fatG: null, carbsG: null, basis: '100g', servingG: null }

const round1 = (n: number) => Math.round(n * 10) / 10

export const fromSaved = (food: SavedFood): FoodDraft => ({
  ...food,
  basis: food.basis ?? 'serving',
  servingG: food.servingG ?? null,
  savedId: food.id,
})

export const fromProduct = (p: Product): FoodDraft => ({
  name: p.name,
  ...p.per100g,
  basis: '100g',
  servingG: p.servingG,
  barcode: p.barcode,
  brand: p.brand,
  servingSize: p.servingSize,
})

// A logged food back into values per unit, so changing the amount rescales it.
// Older entries have no amount: they count as one serving of what was logged.
export function fromMeal(meal: Meal): { food: FoodDraft; amount: number; unit: AmountUnit } {
  const amount = meal.amount ?? 1
  const unit = meal.unit ?? 'serving'
  const per = unit === 'g' ? 100 / amount : 1 / amount
  const scale = (v: number | null) => (v == null ? null : v * per)
  return {
    food: {
      name: meal.description,
      calories: meal.calories * per,
      proteinG: scale(meal.proteinG),
      fatG: scale(meal.fatG),
      carbsG: scale(meal.carbsG),
      basis: unit === 'g' ? '100g' : 'serving',
      servingG: null,
    },
    amount,
    unit,
  }
}

// Where the Amount step starts: one serving, or the label's serving, or 100 g.
export function startAmount(food: FoodDraft): { amount: number; unit: AmountUnit } {
  const [unit] = foodUnits(food)
  return { unit, amount: unit === 'serving' ? 1 : (food.servingG ?? 100) }
}

// What the amount comes to, or null while it isn't a usable amount (or the
// unit doesn't fit the food).
export function eaten(food: FoodDraft, amount: number, unit: AmountUnit) {
  if (!(amount > 0) || !foodUnits(food).includes(unit)) return null
  return scaleFood(food, amountFactor(food, amount, unit))
}

// For POST /saved-foods: whole calories (the column is an integer), macros to a tenth.
export const savedFrom = (food: FoodDraft): Omit<SavedFood, 'id'> => ({
  name: food.name.trim(),
  calories: Math.round(food.calories ?? 0),
  proteinG: food.proteinG == null ? null : round1(food.proteinG),
  fatG: food.fatG == null ? null : round1(food.fatG),
  carbsG: food.carbsG == null ? null : round1(food.carbsG),
  basis: food.basis,
  servingG: food.servingG,
})

// "389 cal · 13g P per 100 g"
export const perBasis = (food: Pick<FoodDraft, 'calories' | 'proteinG'> & FoodBasis) =>
  [food.calories == null ? null : `${Math.round(food.calories)} cal`, formatMacro(food.proteinG, 'g P')].filter(Boolean).join(' · ') +
  ` ${basisLabel(food)}`

// Saved foods, the ones logged most recently first (ids in `recent`, newest
// first), then the rest in their given order; or those matching a search.
export function sortSavedFoods(foods: SavedFood[], recent: string[], query: string) {
  const q = query.trim().toLowerCase()
  if (q) return foods.filter((food) => food.name.toLowerCase().includes(q))
  const rank = (food: SavedFood) => {
    const i = recent.indexOf(food.id)
    return i === -1 ? Infinity : i
  }
  return [...foods].sort((a, b) => rank(a) - rank(b))
}
