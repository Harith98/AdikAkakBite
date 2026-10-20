import { describe, it, expect } from 'vitest'
import { ingredientEmoji, shoppingListMessage, stockFill, suggestedBuy } from '@/lib/inventory-ui'

describe('inventory page helpers', () => {
  it('guesses an emoji from the name, in English or Malay', () => {
    expect(ingredientEmoji('Butter Anchor')).toBe('🧈')
    expect(ingredientEmoji('Tepung Gandum')).toBe('🌾')
    expect(ingredientEmoji('Kotak 8 inci')).toBe('📦')
    expect(ingredientEmoji('Something else')).toBe('🥣')
  })

  it('fills the bar so the reorder level sits halfway', () => {
    expect(stockFill(1, 1)).toBe(50)
    expect(stockFill(4, 1)).toBe(100)
    expect(stockFill(0, 1)).toBe(0)
    expect(stockFill(3, 0)).toBe(100)
  })

  it('suggests buying back up to twice the reorder level', () => {
    expect(suggestedBuy(0.3, 1)).toBe(2) // need 1.7 → rounded up to the next 0.5
    expect(suggestedBuy(2, 12)).toBe(22)
    expect(suggestedBuy(5, 2)).toBe(0)
  })

  it('writes the shopping list for WhatsApp', () => {
    const msg = shoppingListMessage([{ name: 'Butter', unit: 'kg', quantity: 0.3, reorderLevel: 1 }], 'Adikakak Bites')
    expect(msg).toBe('🛒 Senarai belian — Adikakak Bites\n\n- Butter: 2 kg')
  })
})
