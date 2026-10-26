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

// ---------------------------------------------------------------------------
// Saved captions
// ---------------------------------------------------------------------------

export interface SaveCaptionState {
  error: string | null
  nonce: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Adds a caption, or edits one when `captionId` is sent. The text is kept exactly as typed (emojis, line breaks). */
export async function saveCaption(_prev: SaveCaptionState, formData: FormData): Promise<SaveCaptionState> {
  const id = String(formData.get('captionId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').replace(/\r\n/g, '\n').trim()
  if (id && !UUID.test(id)) return { error: 'Invalid caption.', nonce: 0 }
  if (!title) return { error: 'Give it a short name, e.g. "Order info".', nonce: 0 }
  if (title.length > 60) return { error: 'Keep the name under 60 characters.', nonce: 0 }
  if (!body) return { error: 'Write the caption.', nonce: 0 }
  if (body.length > 2200) return { error: 'Instagram allows up to 2,200 characters. Make it a little shorter.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  const { error } = id
    ? await ctx.supabase.from('saved_captions').update({ title, body }).eq('id', id).eq('business_id', ctx.businessId)
    : await ctx.supabase.from('saved_captions').insert({ business_id: ctx.businessId, title, body })
  if (error) {
    return {
      error: /saved_captions/.test(error.message)
        ? 'Saved captions need a database update first: run supabase/updates/2026-10-26_saved_captions.sql in Supabase.'
        : error.message,
      nonce: 0,
    }
  }
  revalidatePath('/content')
  return { error: null, nonce: Date.now() }
}

export async function deleteCaption(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return { error: 'Invalid caption.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { error } = await ctx.supabase.from('saved_captions').delete().eq('id', id).eq('business_id', ctx.businessId)
  if (error) return { error: error.message }
  revalidatePath('/content')
  return { error: null }
}

/** Counts a copy, so the most used captions come first (on the next visit, not while you're copying). */
export async function markCaptionUsed(id: string): Promise<void> {
  if (!UUID.test(id)) return
  const ctx = await getActionContext()
  if (!ctx.ok) return
  const { data } = await ctx.supabase.from('saved_captions').select('use_count').eq('id', id).eq('business_id', ctx.businessId).maybeSingle()
  if (!data) return
  await ctx.supabase
    .from('saved_captions')
    .update({ use_count: data.use_count + 1, last_used_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', ctx.businessId)
}
