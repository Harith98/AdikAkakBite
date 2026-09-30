/**
 * The daily "order due in 2 days" reminder, run each morning by the Vercel
 * cron job (vercel.json → /api/cron/order-reminders).
 *
 * Each order is reminded once per due date (orders.due_reminder_sent_for),
 * so a second run the same day sends nothing, and moving an order to a new
 * date reminds again for that date. An order added less than 2 days ahead is
 * still reminded the next morning ("due tomorrow" / "due today") rather than
 * being skipped.
 */
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ORDER_SELECT, toOrderViews, type OrderRowWithRelations } from '@/lib/services/orders'
import { addDaysISO, daysBetweenISO, getBusinessNow } from '@/lib/time'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { orderDueMessages, type DueOrder } from './messages'
import { notifyTeam, pushConfigured } from './push'

export const REMINDER_DAYS_AHEAD = 2

/** Orders due between today and REMINDER_DAYS_AHEAD days from now that haven't been reminded for that date. */
export function pickOrdersToRemind<T extends { requiredDate: string | null; reminderSentFor: string | null }>(
  orders: T[],
  today: string
): T[] {
  const last = addDaysISO(today, REMINDER_DAYS_AHEAD)
  return orders.filter(
    (o) => o.requiredDate !== null && o.requiredDate >= today && o.requiredDate <= last && o.reminderSentFor !== o.requiredDate
  )
}

export interface ReminderRunResult {
  businesses: number
  ordersReminded: number
  devicesReached: number
  skipped?: string
}

export async function runOrderReminders(): Promise<ReminderRunResult> {
  if (!pushConfigured()) return { businesses: 0, ordersReminded: 0, devicesReached: 0, skipped: 'VAPID keys not set' }
  const admin = createServiceRoleClient()
  if (!admin) return { businesses: 0, ordersReminded: 0, devicesReached: 0, skipped: 'SUPABASE_SERVICE_ROLE_KEY not set' }

  const { data: businesses, error } = await admin.from('business_settings').select('business_id, timezone')
  if (error) throw new Error(`Could not load businesses: ${error.message}`)

  const result: ReminderRunResult = { businesses: 0, ordersReminded: 0, devicesReached: 0 }
  for (const business of businesses ?? []) {
    const today = getBusinessNow(business.timezone || DEFAULT_TIMEZONE).isoDate
    const { data: rows, error: ordersError } = await admin
      .from('orders')
      .select(ORDER_SELECT)
      .eq('business_id', business.business_id)
      .in('status', ['new', 'confirmed', 'preparing', 'ready'])
      .gte('required_date', today)
      .lte('required_date', addDaysISO(today, REMINDER_DAYS_AHEAD))
      .order('required_date', { ascending: true })
      .order('required_time', { ascending: true, nullsFirst: false })
    if (ordersError) throw new Error(`Could not load orders: ${ordersError.message}`)

    const typedRows = (rows ?? []) as unknown as OrderRowWithRelations[]
    const sentFor = new Map(typedRows.map((r) => [r.id, r.due_reminder_sent_for]))
    const due = pickOrdersToRemind(
      toOrderViews(typedRows).map((o) => ({ ...o, reminderSentFor: sentFor.get(o.id) ?? null })),
      today
    )
    result.businesses++
    if (due.length === 0) continue

    const dueOrders: DueOrder[] = due.map((o) => ({
      id: o.id,
      customerName: o.customerName,
      requiredDate: o.requiredDate as string,
      requiredTime: o.requiredTime,
      items: o.items.map((i) => ({ name: i.productName, quantity: i.quantity })),
    }))
    result.devicesReached += await notifyTeam(
      business.business_id,
      'order_due',
      orderDueMessages(dueOrders, (o) => daysBetweenISO(today, o.requiredDate))
    )

    // Mark them reminded for their current due date, one update per date.
    const byDate = new Map<string, string[]>()
    for (const o of dueOrders) byDate.set(o.requiredDate, [...(byDate.get(o.requiredDate) ?? []), o.id])
    for (const [date, ids] of Array.from(byDate)) {
      const { error: markError } = await admin.from('orders').update({ due_reminder_sent_for: date }).in('id', ids)
      if (markError) throw new Error(`Could not mark orders as reminded: ${markError.message}`)
    }
    result.ordersReminded += dueOrders.length
  }
  return result
}
