import { calculateOrderTotals, derivePaymentStatus, type OrderTotals } from '@/lib/calc/orders'
import type { PaymentStatus } from '@/lib/supabase/database.types'
import { isValidPhoneKey, normalizePhone } from '@/lib/customer-identity'
import {
  fail,
  isValidISODate,
  isValidTime,
  parseMoney,
  str,
  UUID_PATTERN,
  type FormSource,
  type ParseResult,
} from './common'

export interface OrderItemInput {
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
}

export interface ParsedOrder {
  customerName: string
  customerPhone: string | null
  requiredDate: string | null
  requiredTime: string | null
  items: OrderItemInput[]
  discount: number
  deliveryFee: number
  deposit: number
  paymentStatus: PaymentStatus
  notes: string | null
  totals: OrderTotals
}

const MAX_ITEMS = 30
const MAX_NAME = 120

/**
 * Validates the order form. The client shows live totals for convenience, but
 * this is the authority: everything is re-checked and re-calculated here.
 */
export function parseOrderForm(form: FormSource): ParseResult<ParsedOrder> {
  const customerName = str(form, 'customerName')
  if (!customerName) return fail('Enter the customer’s name (use “Walk-in” if you don’t have one).')
  if (customerName.length > MAX_NAME) return fail('The customer name is too long.')

  const customerPhone = str(form, 'customerPhone')
  if (customerPhone.length > 30) return fail('The phone number is too long.')
  if (customerPhone) {
    const key = normalizePhone(customerPhone)
    if (!key || !isValidPhoneKey(key)) return fail('Enter a valid phone number, e.g. 012-345 6789.')
  }

  const requiredDate = str(form, 'requiredDate')
  const requiredTime = str(form, 'requiredTime')
  if (requiredDate && !isValidISODate(requiredDate)) return fail('Enter a valid date.')
  if (requiredTime && !isValidTime(requiredTime)) return fail('Enter a valid time.')
  if (requiredTime && !requiredDate) return fail('Add a date for that time.')

  let rawItems: unknown
  try {
    rawItems = JSON.parse(str(form, 'items') || '[]')
  } catch {
    return fail('The items could not be read. Please re-add them.')
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) return fail('Add at least one item.')
  if (rawItems.length > MAX_ITEMS) return fail(`An order can have at most ${MAX_ITEMS} items.`)

  const items: OrderItemInput[] = []
  for (const [index, raw] of rawItems.entries()) {
    const row = (raw ?? {}) as Record<string, unknown>
    const label = `Item ${index + 1}`
    const productName = String(row.productName ?? '').trim()
    if (!productName) return fail(`${label} needs a name.`)
    if (productName.length > MAX_NAME) return fail(`${label}’s name is too long.`)

    const quantity = Number(row.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      return fail(`${label}: quantity must be a whole number between 1 and 1000.`)
    }
    const price = parseMoney(String(row.unitPrice ?? ''), `${label} price`, 100_000)
    if (!price.ok) return price

    const productId = row.productId ? String(row.productId) : null
    if (productId !== null && !UUID_PATTERN.test(productId)) return fail(`${label} has an invalid product.`)

    items.push({ productId, productName, quantity, unitPrice: price.value })
  }

  const discount = parseMoney(str(form, 'discount'), 'Discount')
  if (!discount.ok) return discount
  const deliveryFee = parseMoney(str(form, 'deliveryFee'), 'Delivery fee')
  if (!deliveryFee.ok) return deliveryFee
  const depositInput = parseMoney(str(form, 'deposit'), 'Deposit')
  if (!depositInput.ok) return depositInput

  const subtotal = calculateOrderTotals({ items }).subtotal
  if (discount.value > subtotal) return fail('The discount can’t be more than the items total.')

  const total = calculateOrderTotals({ items, discount: discount.value, deliveryFee: deliveryFee.value }).total
  const paidInFull = form.get('paidInFull') === 'on'
  const deposit = paidInFull ? total : depositInput.value
  if (deposit > total) return fail('The deposit can’t be more than the order total.')

  const notes = str(form, 'notes')
  if (notes.length > 500) return fail('Keep notes under 500 characters.')

  return {
    ok: true,
    value: {
      customerName,
      customerPhone: customerPhone || null,
      requiredDate: requiredDate || null,
      requiredTime: requiredTime || null,
      items,
      discount: discount.value,
      deliveryFee: deliveryFee.value,
      deposit,
      paymentStatus: derivePaymentStatus(total, deposit),
      notes: notes || null,
      totals: calculateOrderTotals({ items, discount: discount.value, deliveryFee: deliveryFee.value, deposit }),
    },
  }
}
