import { describe, expect, it } from 'vitest'
import { EMPTY_FOOD, eaten, fromMeal, fromProduct, fromSaved, perBasis, savedFrom, sortSavedFoods, startAmount } from './foods'
import type { Meal, Product, SavedFood } from './types'

const banana: Product = {
  barcode: '2602605002502',
  name: 'Plátano de Canarias',
  brand: 'Masymas',
  servingSize: null,
  servingG: null,
  per100g: { calories: 93, proteinG: 1.4, fatG: 0.5, carbsG: 21.7 },
}
const bar: SavedFood = { id: 'bar', name: 'Protein bar', calories: 200, proteinG: 20, fatG: 7, carbsG: 15, basis: 'serving', servingG: 60 }
const oldFood: SavedFood = { id: 'old', name: 'Chili', calories: 450, proteinG: 30, fatG: null, carbsG: null }

describe('food drafts', () => {
  it('reads a product per 100 g and starts at 100 g without a label serving', () => {
    const food = fromProduct(banana)
    expect(food).toMatchObject({ name: 'Plátano de Canarias', basis: '100g', calories: 93, barcode: '2602605002502' })
    expect(startAmount(food)).toEqual({ amount: 100, unit: 'g' })
    expect(startAmount({ ...food, servingG: 120 })).toEqual({ amount: 120, unit: 'g' })
  })

  it('treats a saved food from before units existed as per serving', () => {
    expect(fromSaved(oldFood)).toMatchObject({ basis: 'serving', servingG: null, savedId: 'old' })
    expect(startAmount(fromSaved(oldFood))).toEqual({ amount: 1, unit: 'serving' })
  })

  it('works out what an amount comes to, in either unit the food allows', () => {
    expect(eaten(fromProduct(banana), 120, 'g')).toEqual({ calories: 112, proteinG: 1.7, fatG: 0.6, carbsG: 26 })
    expect(eaten(fromSaved(bar), 2, 'serving')?.calories).toBe(400)
    expect(eaten(fromSaved(bar), 30, 'g')?.calories).toBe(100) // half a 60 g bar
  })

  it('has no result for an unusable amount or a unit the food cannot take', () => {
    expect(eaten(fromProduct(banana), 0, 'g')).toBeNull()
    expect(eaten(fromProduct(banana), NaN, 'g')).toBeNull()
    expect(eaten(fromProduct(banana), 1, 'serving')).toBeNull() // no serving weight known
  })

  it('turns a logged food back into values per unit, so a new amount rescales it', () => {
    const meal: Meal = { id: 'm', description: 'Banana', calories: 112, proteinG: 1.7, fatG: null, carbsG: 26, mealName: null, loggedAt: '', amount: 120, unit: 'g' }
    const { food, amount, unit } = fromMeal(meal)
    expect({ amount, unit, basis: food.basis }).toEqual({ amount: 120, unit: 'g', basis: '100g' })
    expect(eaten(food, 240, 'g')).toEqual({ calories: 224, proteinG: 3.4, fatG: null, carbsG: 52 })
  })

  it('counts a logged food with no amount as one serving of what was logged', () => {
    const meal: Meal = { id: 'm', description: 'Lunch', calories: 600, proteinG: 40, fatG: 20, carbsG: 60, mealName: 'Lunch', loggedAt: '' }
    const { food, amount, unit } = fromMeal(meal)
    expect({ amount, unit }).toEqual({ amount: 1, unit: 'serving' })
    expect(eaten(food, 1, 'serving')).toEqual({ calories: 600, proteinG: 40, fatG: 20, carbsG: 60 })
  })

  it('saves whole calories and macros to a tenth', () => {
    expect(savedFrom({ ...EMPTY_FOOD, name: ' Oats ', calories: 389.4, proteinG: 13.15, carbsG: 66.27 })).toEqual({
      name: 'Oats',
      calories: 389,
      proteinG: 13.2,
      fatG: null,
      carbsG: 66.3,
      basis: '100g',
      servingG: null,
    })
  })

  it('describes the values with what they are for', () => {
    expect(perBasis(fromSaved(bar))).toBe('200 cal · 20g P per serving (60 g)')
    expect(perBasis(fromProduct(banana))).toBe('93 cal · 1g P per 100 g')
  })

  it('lists saved foods recently logged first, or the ones matching a search', () => {
    const foods = [oldFood, bar, { ...oldFood, id: 'oats', name: 'Oats' }]
    expect(sortSavedFoods(foods, ['oats', 'bar'], '').map((f) => f.id)).toEqual(['oats', 'bar', 'old'])
    expect(sortSavedFoods(foods, [], ' BAR ').map((f) => f.id)).toEqual(['bar'])
  })
})
