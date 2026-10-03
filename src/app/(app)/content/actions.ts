'use server'

import { revalidatePath } from 'next/cache'
import { getActionContext } from '@/lib/services/action-context'
import { getBusinessNow } from '@/lib/time'
import { isChecklistPlatform, POSTING_CHECKLIST_NOTE, type ChecklistPlatform } from '@/lib/content'

export interface ActionResult {
  error: string | null
}

/**
 * Ticks (or unticks) "posted today" for one platform. A tick is stored as a
 * posted content_items row for today, so it's shared by the whole team and
 * ready for the full content planner later.
 */
export async function setPostedToday(platform: ChecklistPlatform, posted: boolean): Promise<ActionResult> {
  if (!isChecklistPlatform(platform) || typeof posted !== 'boolean') return { error: 'Invalid platform.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, businessId, userId, timezone } = ctx
  const today = getBusinessNow(timezone).isoDate

  const { data: existing, error: findError } = await supabase
    .from('content_items')
    .select('id')
    .eq('business_id', businessId)
    .eq('content_date', today)
    .eq('platform', platform)
    .eq('status', 'posted')
  if (findError) return { error: findError.message }

  if (posted && (existing ?? []).length === 0) {
    const { error } = await supabase.from('content_items').insert({
      business_id: businessId,
      content_date: today,
      platform,
      content_type: 'product_photo',
      status: 'posted',
      notes: POSTING_CHECKLIST_NOTE,
    })
    if (error) return { error: error.message }
    await supabase.from('business_activity_logs').insert({
      business_id: businessId,
      user_id: userId,
      action: 'content_posted',
      entity_type: 'content_item',
      metadata: { platform, date: today },
    })
  }

  if (!posted && (existing ?? []).length > 0) {
    // Only removes checklist ticks, never a fuller content item someone planned.
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('business_id', businessId)
      .eq('content_date', today)
      .eq('platform', platform)
      .eq('notes', POSTING_CHECKLIST_NOTE)
    if (error) return { error: error.message }
  }

  revalidatePath('/content')
  return { error: null }
}
