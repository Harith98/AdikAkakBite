import type { PaymentMethod } from '@/lib/supabase/database.types'
import { normalizePhone } from '@/lib/customer-identity'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  duitnow_qr: 'DuitNow QR',
  card: 'Card',
  ewallet: 'E-wallet',
  other: 'Other',
}

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as string[]).includes(value)
}

/** 12 → "R-000012". Six digits covers a million receipts before it simply grows wider. */
export function formatReceiptNumber(n: number): string {
  return `R-${String(n).padStart(6, '0')}`
}

/** Plain-text receipt summary for sharing on WhatsApp alongside (or instead of) the PDF. */
export function buildReceiptText(input: {
  businessName: string
  receiptNumber: string
  date: string
  customerName: string | null
  items: { name: string; quantity: number; amount: string }[]
  total: string
  paid: string
  balance: string | null
  footer: string
}): string {
  const lines = [
    `*${input.businessName}*`,
    `Receipt ${input.receiptNumber} · ${input.date}`,
    input.customerName ? `Customer: ${input.customerName}` : null,
    '',
    ...input.items.map((i) => `${i.quantity} × ${i.name} — ${i.amount}`),
    '',
    `*Total: ${input.total}*`,
    `Paid: ${input.paid}`,
    input.balance ? `Balance due: ${input.balance}` : null,
    '',
    input.footer,
  ]
  return lines.filter((line): line is string => line !== null).join('\n')
}

/**
 * Phone as typed ("012-345 6789", "+60 12 345 6789") → wa.me digits
 * ("60123456789"), or null if it isn't a usable number.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const key = normalizePhone(phone)
  return key && key.length >= 8 ? key : null
}

/** id of the receipt element on the receipt page; the "Send receipt PDF" button draws it into the PDF. */
export const RECEIPT_ELEMENT_ID = 'receipt'
