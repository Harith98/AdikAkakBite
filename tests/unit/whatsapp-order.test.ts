import { describe, it, expect } from 'vitest'
import { matchProduct, parseWhatsAppOrder, readDate, readTime, WHATSAPP_ORDER_TEMPLATE } from '@/lib/whatsapp-order'

const products = [
  { id: 'p1', name: 'Brownies Klasik', price: 17 },
  { id: 'p2', name: 'Brownies Nutella', price: 20 },
  { id: 'p3', name: 'Kek Batik Indulgence', price: 17 },
  { id: 'p4', name: 'Cheese Tart', price: 2.5 },
]
const today = '2026-10-19' // a Monday

describe('parseWhatsAppOrder', () => {
  it('reads a filled-in template', () => {
    const r = parseWhatsAppOrder(
      [
        '📦 ORDER',
        '',
        '📌 Nama: Aisyah',
        '📅 Tarikh: 25/10, 3pm',
        '🎂 Order: 2 Brownies Klasik, 1 kek batik',
        '📲 Phone No: 012-345 6789',
        '🚗 Pickup / COD: COD',
        '📍 Alamat (kalau COD): No 5, Jalan Mawar, Shah Alam',
      ].join('\n'),
      products,
      today
    )
    expect(r.recognised).toBe(true)
    expect(r.customerName).toBe('Aisyah')
    expect(r.phone).toBe('012-345 6789')
    expect(r.requiredDate).toBe('2026-10-25')
    expect(r.requiredTime).toBe('15:00')
    expect(r.fulfilment).toBe('cod')
    expect(r.notes).toBe('COD — No 5, Jalan Mawar, Shah Alam')
    expect(r.items.map((i) => [i.quantity, i.productId, i.unitPrice])).toEqual([
      [2, 'p1', 17],
      [1, 'p3', 17],
    ])
  })

  it('takes items on the lines after "Order:" and flags what needs a choice', () => {
    const r = parseWhatsAppOrder(
      ['Nama: Farah', 'Tarikh: Sabtu', 'Order:', '- brownies x3', '- 12 biji cheese tart', '- donut', 'Pickup / COD: pickup'].join('\n'),
      products,
      today
    )
    expect(r.requiredDate).toBe('2026-10-24')
    expect(r.fulfilment).toBe('pickup')
    expect(r.items).toHaveLength(3)
    expect(r.items[0]).toMatchObject({ quantity: 3, match: 'ambiguous', candidates: ['Brownies Klasik', 'Brownies Nutella'] })
    expect(r.items[1]).toMatchObject({ quantity: 12, match: 'matched', productId: 'p4' })
    expect(r.items[2]).toMatchObject({ quantity: 1, match: 'unmatched', productName: 'donut' })
    expect(r.warnings.join(' ')).toMatch(/could be Brownies Klasik or Brownies Nutella/)
    expect(r.warnings.join(' ')).toMatch(/No phone number/)
  })

  it('reads a real customer message: no spaces after colons, "ITEM-qty", trailing dot on the address', () => {
    const r = parseWhatsAppOrder(
      [
        '📦 ORDER',
        '',
        '📌 Nama: Syuhada',
        '📅 Tarikh:17/10',
        '🎂 Order:BATIK KLASIK-1,BROWNIES KLASIK-3',
        '📲 Phone No: 018-2261310',
        '🚗 Pickup / COD:  COD ',
        '📍 Alamat (kalau COD): 4865 Mukim 20, Tanah Liat 14000 Bukit Mertajam, Penang .',
      ].join('\n'),
      [...products, { id: 'p5', name: 'Kek Batik Klasik', price: 15 }],
      '2026-10-15'
    )
    expect(r.customerName).toBe('Syuhada')
    expect(r.phone).toBe('018-2261310')
    expect(r.requiredDate).toBe('2026-10-17')
    expect(r.fulfilment).toBe('cod')
    expect(r.notes).toBe('COD — 4865 Mukim 20, Tanah Liat 14000 Bukit Mertajam, Penang')
    expect(r.items.map((i) => [i.quantity, i.productId])).toEqual([
      [1, 'p5'],
      [3, 'p1'],
    ])
  })

  it('treats the blank template as recognised but empty', () => {
    const r = parseWhatsAppOrder(WHATSAPP_ORDER_TEMPLATE, products, today)
    expect(r.recognised).toBe(true)
    expect(r.customerName).toBeNull()
    expect(r.items).toEqual([])
  })

  it('says when nothing looks like the template', () => {
    expect(parseWhatsAppOrder('hi, can I order brownies?', products, today).recognised).toBe(false)
  })

  it('finds a phone number even without its label', () => {
    expect(parseWhatsAppOrder('Nama: Ali\nboleh call 0123456789', products, today).phone).toBe('0123456789')
  })
})

describe('readDate', () => {
  it('reads numeric, named-month, relative and weekday dates', () => {
    expect(readDate('25/10', today)).toBe('2026-10-25')
    expect(readDate('5-11-2026', today)).toBe('2026-11-05')
    expect(readDate('25 Okt', today)).toBe('2026-10-25')
    expect(readDate('3hb Disember', today)).toBe('2026-12-03')
    expect(readDate('esok', today)).toBe('2026-10-20')
    expect(readDate('lusa', today)).toBe('2026-10-21')
    expect(readDate('Sabtu ini', today)).toBe('2026-10-24')
    expect(readDate('Isnin depan', today)).toBe('2026-10-26')
  })

  it('rolls a well-past day/month into next year and rejects impossible dates', () => {
    expect(readDate('5/1', today)).toBe('2027-01-05')
    expect(readDate('31/2', today)).toBeNull()
  })
})

describe('readTime', () => {
  it('reads 12-hour, Malay and 24-hour times', () => {
    expect(readTime('3pm').time).toBe('15:00')
    expect(readTime('10.30 pagi').time).toBe('10:30')
    expect(readTime('3 petang').time).toBe('15:00')
    expect(readTime('12 tengah hari').time).toBe('12:00')
    expect(readTime('15:45').time).toBe('15:45')
    expect(readTime('jam 4').time).toBe('16:00')
    expect(readTime('25/10').time).toBeNull()
  })
})

describe('matchProduct', () => {
  it('forgives small typos and plurals', () => {
    expect(matchProduct('brownis klasik', products).productId).toBe('p1')
    expect(matchProduct('nutela brownie', products).productId).toBe('p2')
  })
})
