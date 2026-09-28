import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PaymentStatus } from '@/lib/supabase/database.types'
import { calculateOrderTotals } from '@/lib/calc/orders'
import { getInventoryStatus, needsReorder } from '@/lib/calc/inventory'
import type { EngineInventoryAlert, EngineOrder } from './recommendation'
import type { ScheduleBlockLike, TaskLike } from './schedule'

type Client = SupabaseClient<Database, 'public'>
type TaskRow = Database['public']['Tables']['tasks']['Row']
type TaskInsert = Database['public']['Tables']['tasks']['Insert']

export interface TodayOrder extends EngineOrder {
  paymentStatus: PaymentStatus
  items: { name: string; quantity: number }[]
  total: number
  balance: number
  notes: string | null
}

export interface TodayData {
  blocks: ScheduleBlockLike[]
  tasks: TaskLike[]
  orders: TodayOrder[]
  inventoryAlerts: EngineInventoryAlert[]
}

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Could not load ${what}: ${result.error.message}`)
  return (result.data ?? []) as T
}

function toTaskLike(row: TaskRow): TaskLike {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    priority: row.priority,
    status: row.status,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    scheduleBlockId: row.schedule_block_id,
    sortOrder: row.sort_order,
    dailyPriorityRank: row.daily_priority_rank,
    source: row.source,
    orderId: row.order_id,
  }
}

/**
 * Everything the Today screen needs, in as few round trips as possible.
 *
 * Tasks loaded: everything scheduled for today, plus unfinished MANUAL tasks
 * from earlier days (so a forgotten high-priority task can still surface as
 * overdue). Unfinished schedule-generated tasks from earlier days are not
 * carried over — the Closing block's "Review unfinished tasks" covers those.
 */
export async function getTodayData(
  supabase: Client,
  businessId: string,
  today: string,
  isWorkingDay: boolean
): Promise<TodayData> {
  const fetchTasks = () =>
    supabase
      .from('tasks')
      .select('*')
      .eq('business_id', businessId)
      .or(
        `scheduled_date.eq.${today},and(scheduled_date.lt.${today},source.neq.schedule,status.in.(not_started,in_progress,paused))`
      )
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

  const [blocksRes, tasksRes, ordersRes, inventoryRes] = await Promise.all([
    supabase
      .from('schedule_blocks')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('start_time', { ascending: true }),
    fetchTasks(),
    supabase
      .from('orders')
      .select('*')
      .eq('business_id', businessId)
      .lte('required_date', today)
      .in('status', ['new', 'confirmed', 'preparing', 'ready'])
      .order('required_date', { ascending: true })
      .order('required_time', { ascending: true, nullsFirst: false }),
    supabase
      .from('inventory_items')
      .select('id, name, current_quantity, unit, reorder_level')
      .eq('business_id', businessId),
  ])

  const blockRows = must(blocksRes, 'schedule')
  let taskRows = must(tasksRes, 'tasks')
  const orderRows = must(ordersRes, 'orders')
  const inventoryRows = must(inventoryRes, 'inventory')

  // Create today's tasks from each block's default tasks the first time the
  // day is viewed. Idempotent: a unique index + ignoreDuplicates means a
  // repeat or racing request cannot create duplicates.
  if (isWorkingDay) {
    const existing = new Set(
      taskRows
        .filter((t) => t.schedule_block_id && t.scheduled_date === today)
        .map((t) => `${t.schedule_block_id}::${t.title}`)
    )
    const missing: TaskInsert[] = blockRows.flatMap((block) =>
      Array.from(new Set(block.default_tasks.map((t) => t.trim()).filter(Boolean)))
        .map((title, index): TaskInsert => ({
          business_id: businessId,
          title,
          category: block.category,
          priority: 0,
          scheduled_date: today,
          scheduled_time: block.start_time,
          status: 'not_started',
          is_recurring: true,
          source: 'schedule',
          schedule_block_id: block.id,
          sort_order: index,
        }))
        .filter((row) => !existing.has(`${row.schedule_block_id}::${row.title}`))
    )
    if (missing.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .upsert(missing, { onConflict: 'business_id,scheduled_date,schedule_block_id,title', ignoreDuplicates: true })
      if (error) throw new Error(`Could not create today's tasks: ${error.message}`)
      taskRows = must(await fetchTasks(), 'tasks')
    }
  }

  // Order details (items + customer names), fetched only if there are orders.
  const orderIds = orderRows.map((o) => o.id)
  const customerIds = Array.from(new Set(orderRows.map((o) => o.customer_id).filter((id): id is string => id !== null)))
  const [itemsRes, customersRes] = await Promise.all([
    orderIds.length > 0 ? supabase.from('order_items').select('*').in('order_id', orderIds) : Promise.resolve(null),
    customerIds.length > 0 ? supabase.from('customers').select('id, name').in('id', customerIds) : Promise.resolve(null),
  ])
  const itemRows = itemsRes ? must(itemsRes, 'order items') : []
  const customerRows = customersRes ? must(customersRes, 'customers') : []
  const customerNames = new Map(customerRows.map((c) => [c.id, c.name]))

  const orders: TodayOrder[] = orderRows.map((o) => {
    const items = itemRows.filter((i) => i.order_id === o.id)
    const totals = calculateOrderTotals({
      items: items.map((i) => ({ quantity: i.quantity, unitPrice: i.unit_price })),
      discount: o.discount,
      deliveryFee: o.delivery_fee,
      deposit: o.deposit,
    })
    return {
      id: o.id,
      customerName: o.customer_id ? customerNames.get(o.customer_id) ?? null : null,
      requiredDate: o.required_date,
      requiredTime: o.required_time,
      status: o.status,
      paymentStatus: o.payment_status,
      items: items.map((i) => ({ name: i.product_name, quantity: i.quantity })),
      total: totals.total,
      balance: totals.balance,
      notes: o.notes,
    }
  })

  // Inventory is a small table for a small business, so it is filtered here
  // rather than in SQL (PostgREST can't compare two columns of the same row).
  const inventoryAlerts: EngineInventoryAlert[] = inventoryRows
    .filter((i) => needsReorder(getInventoryStatus(i.current_quantity, i.reorder_level)))
    .map((i) => ({
      id: i.id,
      name: i.name,
      currentQuantity: i.current_quantity,
      unit: i.unit,
      reorderLevel: i.reorder_level,
    }))

  return {
    blocks: blockRows.map((b) => ({
      id: b.id,
      title: b.title,
      category: b.category,
      startTime: b.start_time.slice(0, 5),
      endTime: b.end_time.slice(0, 5),
      sortOrder: b.sort_order,
    })),
    tasks: taskRows.map(toTaskLike),
    orders,
    inventoryAlerts,
  }
}
