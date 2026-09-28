'use server'

import { revalidatePath } from 'next/cache'
import type { OrderStatus, TaskCategory, TaskStatus } from '@/lib/supabase/database.types'
import { TASK_CATEGORY_OPTIONS } from '@/lib/constants'
import { getActionContext } from '@/lib/services/action-context'
import { getBusinessNow } from '@/lib/time'

export interface ActionResult {
  error: string | null
}

export interface AddTaskState {
  error: string | null
  /** Changes on every successful save so the form knows to reset itself. */
  nonce: number
}

const TASK_STATUSES: readonly TaskStatus[] = ['not_started', 'in_progress', 'paused', 'completed', 'skipped']
const ORDER_STATUSES: readonly OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']
const CATEGORIES: readonly string[] = TASK_CATEGORY_OPTIONS.map((c) => c.value)
const MAX_TITLE = 120

/** Start / complete / pause / skip a task (spec §7, §11). */
export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<ActionResult> {
  if (!TASK_STATUSES.includes(status)) return { error: 'Invalid task status.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, businessId, userId } = ctx

  // Only one task is "in progress" at a time — starting one pauses the rest,
  // so "the current task" is never ambiguous.
  if (status === 'in_progress') {
    await supabase
      .from('tasks')
      .update({ status: 'paused' })
      .eq('business_id', businessId)
      .eq('status', 'in_progress')
      .neq('id', taskId)
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', taskId)
    .eq('business_id', businessId)
    .select('id, title')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'That task could not be found.' }

  if (status === 'completed') {
    await supabase.from('business_activity_logs').insert({
      business_id: businessId,
      user_id: userId,
      action: 'task_completed',
      entity_type: 'task',
      entity_id: data.id,
      metadata: { title: data.title },
    })
  }

  revalidatePath('/today')
  return { error: null }
}

/**
 * Move an order along (preparing → ready → completed). Completing an order
 * also completes any task linked to it, so the normal daily workflow resumes.
 */
export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  if (!ORDER_STATUSES.includes(status)) return { error: 'Invalid order status.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, businessId, userId } = ctx

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'That order could not be found.' }

  if (status === 'completed') {
    await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('order_id', orderId)
      .in('status', ['not_started', 'in_progress', 'paused'])
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: status === 'completed' ? 'order_completed' : 'order_status_changed',
    entity_type: 'order',
    entity_id: orderId,
    metadata: { status },
  })

  revalidatePath('/today')
  revalidatePath('/orders', 'layout')
  return { error: null }
}

/** Quick-add a manual task for today. */
export async function addTask(_prev: AddTaskState, formData: FormData): Promise<AddTaskState> {
  const title = String(formData.get('title') ?? '').trim()
  const category = String(formData.get('category') ?? 'business')
  const priority = String(formData.get('priority') ?? '0') === '2' ? 2 : 0

  if (!title) return { error: 'Give the task a name.', nonce: 0 }
  if (title.length > MAX_TITLE) return { error: `Keep the name under ${MAX_TITLE} characters.`, nonce: 0 }
  if (!CATEGORIES.includes(category)) return { error: 'Pick a category.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }

  const { error } = await ctx.supabase.from('tasks').insert({
    business_id: ctx.businessId,
    title,
    category: category as TaskCategory,
    priority,
    scheduled_date: getBusinessNow(ctx.timezone).isoDate,
    source: 'manual',
  })
  if (error) return { error: error.message, nonce: 0 }

  revalidatePath('/today')
  return { error: null, nonce: Date.now() }
}

/** Set (or clear, if the title is empty) one of today's three priorities. */
export async function savePriority(rank: number, rawTitle: string): Promise<ActionResult> {
  if (![1, 2, 3].includes(rank)) return { error: 'Priority must be 1, 2 or 3.' }
  const title = rawTitle.trim()
  if (title.length > MAX_TITLE) return { error: `Keep it under ${MAX_TITLE} characters.` }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, businessId, timezone } = ctx
  const today = getBusinessNow(timezone).isoDate

  const { data: existing, error: findError } = await supabase
    .from('tasks')
    .select('id')
    .eq('business_id', businessId)
    .eq('scheduled_date', today)
    .eq('daily_priority_rank', rank)
    .maybeSingle()
  if (findError) return { error: findError.message }

  if (!title) {
    if (existing) {
      const { error } = await supabase.from('tasks').delete().eq('id', existing.id).eq('business_id', businessId)
      if (error) return { error: error.message }
    }
  } else if (existing) {
    const { error } = await supabase.from('tasks').update({ title }).eq('id', existing.id).eq('business_id', businessId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('tasks').insert({
      business_id: businessId,
      title,
      category: 'business',
      priority: 2,
      scheduled_date: today,
      source: 'manual',
      daily_priority_rank: rank,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/today')
  return { error: null }
}
