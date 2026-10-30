import { describe, it, expect } from 'vitest'
import { lowStockMessage, orderDueMessages, scheduleChangeMessage, shouldAlertLowStock } from '@/lib/notifications/messages'
import { pickOrdersToRemind } from '@/lib/notifications/order-reminders'
import { addDaysISO } from '@/lib/time'

describe('shouldAlertLowStock', () => {
  it('alerts when an item newly needs reordering or runs out', () => {
    expect(shouldAlertLowStock('ok', 'reorder')).toBe(true)
    expect(shouldAlertLowStock('low', 'reorder')).toBe(true)
    expect(shouldAlertLowStock('reorder', 'out_of_stock')).toBe(true)
  })

  it('stays quiet for Low, for no change, and when stock improves', () => {
    expect(shouldAlertLowStock('ok', 'low')).toBe(false)
    expect(shouldAlertLowStock('reorder', 'reorder')).toBe(false)
    expect(shouldAlertLowStock('out_of_stock', 'reorder')).toBe(false)
  })

  it('links to the item', () => {
    const m = lowStockMessage({ id: 'i1', name: 'Butter', unit: 'kg', currentQuantity: 0.5, reorderLevel: 1, status: 'reorder' })
    expect(m.title).toBe('Low stock: Butter')
    expect(m.body).toContain('0.5 kg left')
    expect(m.url).toBe('/business/inventory/i1')
  })
})

describe('order reminders', () => {
  const today = '2026-10-01'
  const order = (id: string, requiredDate: string | null, reminderSentFor: string | null = null) => ({ id, requiredDate, reminderSentFor })

  it('picks orders due within 2 days that have not been reminded for that date', () => {
    const picked = pickOrdersToRemind(
      [
        order('in2', '2026-10-03'),
        order('in1', '2026-10-02'),
        order('in3', '2026-10-04'),
        order('past', '2026-09-30'),
        order('noDate', null),
        order('done', '2026-10-03', '2026-10-03'),
        order('moved', '2026-10-03', '2026-10-10'),
      ],
      today
    ).map((o) => o.id)
    expect(picked).toEqual(['in2', 'in1', 'moved'])
  })

  it('words the reminder by how far away the order is', () => {
    const [m] = orderDueMessages(
      [{ id: 'o1', customerName: 'Aisyah', requiredDate: '2026-10-03', requiredTime: '15:00', items: [{ name: 'Brownies', quantity: 2 }] }],
      () => 2
    )
    expect(m?.title).toBe('Order due in 2 days: Aisyah')
    expect(m?.body).toContain('2× Brownies')
    expect(m?.url).toBe('/orders/o1')
  })

  it('sends one summary instead of many notifications on a busy day', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: `o${i}`,
      customerName: `C${i}`,
      requiredDate: '2026-10-03',
      requiredTime: null,
      items: [],
    }))
    const messages = orderDueMessages(many, () => 2)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.title).toBe('5 orders coming up')
  })

  it('adds days across month ends', () => {
    expect(addDaysISO('2026-10-31', 2)).toBe('2026-11-02')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('scheduleChangeMessage', () => {
  const block = { title: 'Baking', startTime: '09:00:00', endTime: '12:00:00', isActive: true }

  it('announces new, removed, moved and switched blocks', () => {
    expect(scheduleChangeMessage(null, block)?.body).toMatch(/^New: Baking/)
    expect(scheduleChangeMessage(block, null)?.body).toMatch(/was removed/)
    expect(scheduleChangeMessage(block, { ...block, startTime: '10:00' })?.body).toMatch(/Baking is now .* \(was /)
    expect(scheduleChangeMessage(block, { ...block, isActive: false })?.body).toMatch(/off the schedule/)
  })

  it('stays quiet for renames, same times and inactive blocks', () => {
    expect(scheduleChangeMessage(block, { ...block, title: 'Bake', startTime: '09:00' })).toBeNull()
    expect(scheduleChangeMessage(null, { ...block, isActive: false })).toBeNull()
  })
})

describe('postingReminderMessage', () => {
  it('names what is left and the streak at stake', async () => {
    const { postingReminderMessage } = await import('@/lib/notifications/messages')
    const m = postingReminderMessage(['Facebook', 'WhatsApp'], 5)
    expect(m?.title).toBe('🔥 Keep your 5-day posting streak')
    expect(m?.body).toContain('Facebook and WhatsApp')
    expect(m?.url).toBe('/content')
  })

  it('nudges without a streak, and says nothing once all are posted', async () => {
    const { postingReminderMessage } = await import('@/lib/notifications/messages')
    expect(postingReminderMessage(['Instagram', 'Facebook', 'WhatsApp'], 0)?.body).toContain('Instagram, Facebook and WhatsApp')
    expect(postingReminderMessage([], 3)).toBeNull()
  })
})

describe('catalogueLimitMessage', () => {
  it('says what customers get now and what to do', async () => {
    const { catalogueLimitMessage } = await import('@/lib/notifications/messages')
    expect(catalogueLimitMessage({ mode: 'auto', hasLink: true }).body).toMatch(/now get your Canva \/ Drive link/)
    expect(catalogueLimitMessage({ mode: 'upload', hasLink: true }).body).toMatch(/Switch to Automatic or Link/)
    expect(catalogueLimitMessage({ mode: 'auto', hasLink: false }).body).toMatch(/Add a Canva or Google Drive link/)
    expect(catalogueLimitMessage({ mode: 'auto', hasLink: true }).url).toBe('/settings/menu')
  })
})

describe('cleanCatalogueLink', () => {
  it('accepts https links (adding https:// if missing) and refuses others', async () => {
    const { cleanCatalogueLink } = await import('@/lib/catalogue')
    expect(cleanCatalogueLink('https://www.canva.com/design/abc/view')).toEqual({ ok: true, url: 'https://www.canva.com/design/abc/view' })
    expect(cleanCatalogueLink('drive.google.com/file/d/xyz/view')).toEqual({ ok: true, url: 'https://drive.google.com/file/d/xyz/view' })
    expect(cleanCatalogueLink('')).toEqual({ ok: true, url: null })
    expect(cleanCatalogueLink('http://example.com/a').ok).toBe(false)
    expect(cleanCatalogueLink('not a link at all').ok).toBe(false)
  })
})
