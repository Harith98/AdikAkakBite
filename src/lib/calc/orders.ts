export interface OrderLine {
  quantity: number
  unitPrice: number
}

export interface OrderTotals {
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  deposit: number
  balance: number
}

/** Invalid, negative or non-finite numbers count as 0 rather than corrupting a total. */
function safe(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * total = sum(quantity × unit price) − discount + delivery fee
 * balance = total − deposit
 * A discount can never exceed the subtotal and a deposit can never exceed the
 * total, so neither total nor balance is ever negative.
 */
export function calculateOrderTotals(input: {
  items: OrderLine[]
  discount?: number | null
  deliveryFee?: number | null
  deposit?: number | null
}): OrderTotals {
  const subtotal = round2(input.items.reduce((sum, item) => sum + safe(item.quantity) * safe(item.unitPrice), 0))
  const discount = Math.min(safe(input.discount), subtotal)
  const deliveryFee = safe(input.deliveryFee)
  const total = round2(subtotal - discount + deliveryFee)
  const deposit = Math.min(safe(input.deposit), total)
  return { subtotal, discount, deliveryFee, total, deposit, balance: round2(total - deposit) }
}

export type DerivedPaymentStatus = 'unpaid' | 'deposit_paid' | 'fully_paid'

/**
 * Payment status follows the money, so it can never contradict the numbers:
 * nothing paid → unpaid; something paid → deposit paid; the whole total paid
 * (a positive total) → fully paid.
 */
export function derivePaymentStatus(total: number, deposit: number): DerivedPaymentStatus {
  if (deposit <= 0) return 'unpaid'
  if (total > 0 && deposit >= total) return 'fully_paid'
  return 'deposit_paid'
}
