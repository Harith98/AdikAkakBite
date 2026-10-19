import { describe, it, expect } from 'vitest'
import { limitingIngredient, recipeCostPerBatch, recipeCostPerUnit, unitsMakeable } from '@/lib/calc/recipes'

// One tray of brownies makes 12: 0.25 kg butter (RM 40/kg), 0.2 kg chocolate (RM 30/kg), 12 boxes (RM 0.50 each).
const lines = [
  { quantity: 0.25, unitCost: 40, currentQuantity: 1 },
  { quantity: 0.2, unitCost: 30, currentQuantity: 0.3 },
  { quantity: 12, unitCost: 0.5, currentQuantity: 100 },
]

describe('recipe costs', () => {
  it('costs a batch and a unit', () => {
    expect(recipeCostPerBatch(lines)).toBe(22) // 10 + 6 + 6
    expect(recipeCostPerUnit(lines, 12)).toBe(1.83)
  })

  it('treats a missing or zero yield as one', () => {
    expect(recipeCostPerUnit(lines, 0)).toBe(22)
  })
})

describe('unitsMakeable', () => {
  it('is limited by the scarcest ingredient', () => {
    // chocolate: 0.3 kg / (0.2/12 per unit) = 18 units; butter allows 48; boxes 100
    expect(unitsMakeable(lines, 12)).toBe(18)
    expect(limitingIngredient(lines)).toBe(1)
  })

  it('is zero when something is out and null without a recipe', () => {
    expect(unitsMakeable([{ quantity: 1, unitCost: 1, currentQuantity: 0 }], 1)).toBe(0)
    expect(unitsMakeable([], 12)).toBeNull()
  })
})
