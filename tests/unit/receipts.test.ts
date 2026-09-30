import { describe, it, expect } from 'vitest'
import { buildReceiptText, formatReceiptNumber, isPaymentMethod, toWhatsAppNumber } from '@/lib/receipts'

describe('receipts', () => {
  it('formats receipt numbers with a fixed-width, zero-padded sequence', () => {
    expect(formatReceiptNumber(1)).toBe('R-000001')
    expect(formatReceiptNumber(123456)).toBe('R-123456')
    expect(formatReceiptNumber(1234567)).toBe('R-1234567')
  })

  it('accepts only known payment methods', () => {
    expect(isPaymentMethod('duitnow_qr')).toBe(true)
    expect(isPaymentMethod('bitcoin')).toBe(false)
  })

  it('builds a WhatsApp summary, omitting empty lines like balance due', () => {
    const text = buildReceiptText({
      businessName: 'AdikAkak Bite',
      receiptNumber: 'R-000007',
      date: '30 Sep 2026',
      customerName: 'Aina',
      items: [{ name: 'Brownies', quantity: 2, amount: 'RM 30.00' }],
      total: 'RM 30.00',
      paid: 'RM 30.00',
      balance: null,
      footer: 'Thank you!',
    })
    expect(text).toContain('Receipt R-000007 · 30 Sep 2026')
    expect(text).toContain('2 × Brownies — RM 30.00')
    expect(text).not.toContain('Balance due')
  })
})

describe('toWhatsAppNumber', () => {
  it('normalises Malaysian numbers to wa.me format', () => {
    expect(toWhatsAppNumber('012-345 6789')).toBe('60123456789')
    expect(toWhatsAppNumber('+60 12 345 6789')).toBe('60123456789')
    expect(toWhatsAppNumber('0060123456789')).toBe('60123456789')
  })

  it('returns null when there is no usable number', () => {
    expect(toWhatsAppNumber(null)).toBeNull()
    expect(toWhatsAppNumber('123')).toBeNull()
  })
})
