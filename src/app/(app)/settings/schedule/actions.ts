'use server'

import { revalidatePath } from 'next/cache'
import type { TaskCategory } from '@/lib/supabase/database.types'
import { TASK_CATEGORY_OPTIONS } from '@/lib/constants'
import { getActionContext } from '@/lib/services/action-context'
import { UUID_PATTERN } from '@/lib/validation/common'
import { canManageBusiness } from '@/lib/team'

export interface ScheduleFormState {
  error: string | null
  /** Changes on every successful save. */
  nonce: number
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const CATEGORIES: readonly string[] = TASK_CATEGORY_OPTIONS.map((c) => c.value)
const MAX_TASKS = 20
const MAX_TITLE = 120

/** Create (no id) or update (id) one schedule block. */
export async function saveScheduleBlock(_prev: ScheduleFormState, formData: FormData): Promise<ScheduleFormState> {
  const id = String(formData.get('id') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const category = String(formData.get('category') ?? '')
  const startTime = String(formData.get('startTime') ?? '')
  const endTime = String(formData.get('endTime') ?? '')
  const isActive = formData.get('isActive') === 'on'
  const defaultTasks = Array.from(
    new Set(
      String(formData.get('defaultTasks') ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    )
  )

  if (id && !UUID_PATTERN.test(id)) return { error: 'Invalid block.', nonce: 0 }
  if (!title) return { error: 'Give the block a name.', nonce: 0 }
  if (title.length > MAX_TITLE) return { error: `Keep the name under ${MAX_TITLE} characters.`, nonce: 0 }
  if (!CATEGORIES.includes(category)) return { error: 'Pick a category.', nonce: 0 }
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return { error: 'Enter valid start and end times.', nonce: 0 }
  if (endTime <= startTime) return { error: 'The end time must be after the start time.', nonce: 0 }
  if (defaultTasks.length > MAX_TASKS) return { error: `Use at most ${MAX_TASKS} tasks per block.`, nonce: 0 }
  if (defaultTasks.some((t) => t.length > MAX_TITLE)) return { error: `Keep each task under ${MAX_TITLE} characters.`, nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  if (!canManageBusiness(ctx.role)) return { error: 'Only owners and admins can change the schedule.', nonce: 0 }
  const { supabase, businessId } = ctx

  if (id) {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .update({
        title,
        category: category as TaskCategory,
        start_time: startTime,
        end_time: endTime,
        default_tasks: defaultTasks,
        is_active: isActive,
      })
      .eq('id', id)
      .eq('business_id', businessId)
      .select('id')
      .maybeSingle()
    if (error) return { error: error.message, nonce: 0 }
    if (!data) return { error: 'That block could not be found.', nonce: 0 }
  } else {
    const { data: last } = await supabase
      .from('schedule_blocks')
      .select('sort_order')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { error } = await supabase.from('schedule_blocks').insert({
      business_id: businessId,
      title,
      category: category as TaskCategory,
      start_time: startTime,
      end_time: endTime,
      default_tasks: defaultTasks,
      is_active: isActive,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    if (error) return { error: error.message, nonce: 0 }
  }

  revalidatePath('/settings/schedule')
  revalidatePath('/today')
  return { error: null, nonce: Date.now() }
}

export async function deleteScheduleBlock(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!UUID_PATTERN.test(id)) return
  const ctx = await getActionContext()
  if (!ctx.ok) throw new Error(ctx.error)
  if (!canManageBusiness(ctx.role)) throw new Error('Only owners and admins can change the schedule.')
  const { error } = await ctx.supabase.from('schedule_blocks').delete().eq('id', id).eq('business_id', ctx.businessId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/schedule')
  revalidatePath('/today')
}
