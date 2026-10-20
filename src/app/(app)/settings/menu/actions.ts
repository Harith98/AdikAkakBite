'use server'

import { revalidatePath } from 'next/cache'
import { getActionContext } from '@/lib/services/action-context'
import { canManageBusiness } from '@/lib/team'
import { CATALOGUE_BUCKET, catalogueFilePath } from '@/lib/catalogue'

export interface ActionResult {
  error: string | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

/** Makes an uploaded PDF the customer menu's catalogue, and deletes the previous one. */
export async function saveCatalogue(url: string): Promise<ActionResult> {
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  if (!canManageBusiness(ctx.role)) return { error: 'Only the owner or an admin can change the menu.' }
  const path = catalogueFilePath(url, SUPABASE_URL)
  if (!path || !path.startsWith(`${ctx.businessId}/`)) return { error: 'That upload couldn’t be used. Please try again.' }

  const { data: before } = await ctx.supabase.from('businesses').select('menu_pdf_url').eq('id', ctx.businessId).maybeSingle()
  const { error } = await ctx.supabase
    .from('businesses')
    .update({ menu_pdf_url: url, menu_pdf_updated_at: new Date().toISOString() })
    .eq('id', ctx.businessId)
  if (error) return { error: error.message }

  await removeFile(ctx.supabase, before?.menu_pdf_url, url)
  await ctx.supabase.from('business_activity_logs').insert({
    business_id: ctx.businessId,
    user_id: ctx.userId,
    action: 'menu_catalogue_updated',
    entity_type: 'business',
    entity_id: ctx.businessId,
  })
  revalidatePath('/menu')
  revalidatePath('/settings/menu')
  return { error: null }
}

/** Takes the catalogue off the customer menu (the order form stays). */
export async function removeCatalogue(): Promise<ActionResult> {
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  if (!canManageBusiness(ctx.role)) return { error: 'Only the owner or an admin can change the menu.' }
  const { data: before } = await ctx.supabase.from('businesses').select('menu_pdf_url').eq('id', ctx.businessId).maybeSingle()
  const { error } = await ctx.supabase
    .from('businesses')
    .update({ menu_pdf_url: null, menu_pdf_updated_at: null })
    .eq('id', ctx.businessId)
  if (error) return { error: error.message }
  await removeFile(ctx.supabase, before?.menu_pdf_url, null)
  revalidatePath('/menu')
  revalidatePath('/settings/menu')
  return { error: null }
}

/** Deletes the old PDF from storage (best effort), unless it's the one now in use. */
async function removeFile(supabase: any, oldUrl: string | null | undefined, keepUrl: string | null) {
  if (!oldUrl || oldUrl === keepUrl) return
  const path = catalogueFilePath(oldUrl, SUPABASE_URL)
  if (!path) return
  const { error } = await supabase.storage.from(CATALOGUE_BUCKET).remove([path])
  if (error) console.error('Could not delete the old catalogue:', error.message)
}
