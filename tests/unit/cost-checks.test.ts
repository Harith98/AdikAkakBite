import { describe, it, expect } from 'vitest'
import { checkRecipeCosts } from '@/lib/calc/cost-checks'

const product = (id: string, savedIngredientCost: number, recipeYield = 1) => ({ id, name: id, category: null, recipeYield, savedIngredientCost })

describe('checkRecipeCosts', () => {
  it('flags products whose saved cost no longer matches their recipe at today’s prices', () => {
    const checks = checkRecipeCosts(
      [product('brownies', 8.5, 2), product('batik', 12), product('no-recipe', 5)],
      [
        // brownies: 0.5 kg butter at RM 36/kg + 1 kg flour at RM 3/kg = RM 21 a batch of 2 → RM 10.50 each
        { productId: 'brownies', inventoryItemId: 'butter', quantity: 0.5, unitCost: 36 },
        { productId: 'brownies', inventoryItemId: 'flour', quantity: 1, unitCost: 3 },
        // batik: 2 × RM 6 = RM 12 → matches what's saved
        { productId: 'batik', inventoryItemId: 'biscuits', quantity: 2, unitCost: 6 },
      ]
    )
    expect(checks.map((c) => [c.productId, c.savedCost, c.recipeCost, c.outdated])).toEqual([
      ['brownies', 8.5, 10.5, true],
      ['batik', 12, 12, false],
    ])
    expect(checks[0]!.itemIds).toEqual(['butter', 'flour'])
  })

  it('ignores differences under a sen', () => {
    const [check] = checkRecipeCosts([product('x', 3.333)], [{ productId: 'x', inventoryItemId: 'i', quantity: 1, unitCost: 3.334 }])
    expect(check!.outdated).toBe(false)
  })
})
