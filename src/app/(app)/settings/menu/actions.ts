'use server'

import { revalidatePath } from 'next/cache'
import { getActionContext } from '@/lib/services/action-context'
import { canManageBusiness } from '@/lib/team'
import { CATALOGUE_BUCKET, CATALOGUE_MAX_BYTES, catalogueFilePath, cleanCatalogueLink, type CatalogueMode } from '@/lib/catalogue'

export interface ActionResult {
  error: string | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

/** True when the database doesn't have the catalogue safety-net columns yet (before its update). */
const noFallbackColumns = (message: string) => /menu_pdf_bytes|catalogue_link_url|catalogue_mode/.test(message)

/** Makes an uploaded PDF the customer menu's catalogue (with its size, for the data estimate), and deletes the previous one. */
export async function saveCatalogue(url: string, bytes: number): Promise<ActionResult> {
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  if (!canManageBusiness(ctx.role)) return { error: 'Only the owner or an admin can change the menu.' }
  const path = catalogueFilePath(url, SUPABASE_URL)
  if (!path || !path.startsWith(`${ctx.businessId}/`)) return { error: 'That upload couldn’t be used. Please try again.' }

  const { data: before } = await ctx.supabase.from('businesses').select('menu_pdf_url').eq('id', ctx.businessId).maybeSingle()
  const row = { menu_pdf_url: url, menu_pdf_updated_at: new Date().toISOString() }
  const size = Number.isInteger(bytes) && bytes > 0 && bytes <= CATALOGUE_MAX_BYTES ? bytes : null
  let { error } = await ctx.supabase.from('businesses').update({ ...row, menu_pdf_bytes: size }).eq('id', ctx.businessId)
  if (error && noFallbackColumns(error.message)) ({ error } = await ctx.supabase.from('businesses').update(row).eq('id', ctx.businessId))
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
  const row = { menu_pdf_url: null, menu_pdf_updated_at: null }
  let { error } = await ctx.supabase.from('businesses').update({ ...row, menu_pdf_bytes: null }).eq('id', ctx.businessId)
  if (error && noFallbackColumns(error.message)) ({ error } = await ctx.supabase.from('businesses').update(row).eq('id', ctx.businessId))
  if (error) return { error: error.message }
  await removeFile(ctx.supabase, before?.menu_pdf_url, null)
  revalidatePath('/menu')
  revalidatePath('/settings/menu')
  return { error: null }
}

export interface CatalogueSourceState {
  error: string | null
  nonce: number
}

const MODES: CatalogueMode[] = ['auto', 'upload', 'link']

/** The catalogue link (Canva / Google Drive) and what "View catalogue" opens. */
export async function saveCatalogueSource(_prev: CatalogueSourceState, formData: FormData): Promise<CatalogueSourceState> {
  const link = cleanCatalogueLink(String(formData.get('link') ?? ''))
  if (!link.ok) return { error: link.error, nonce: 0 }
  const mode = String(formData.get('mode') ?? 'auto') as CatalogueMode
  if (!MODES.includes(mode)) return { error: 'Choose what the catalogue button opens.', nonce: 0 }
  if (mode === 'link' && !link.url) return { error: 'Add the link first, or choose another option.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  if (!canManageBusiness(ctx.role)) return { error: 'Only the owner or an admin can change the menu.', nonce: 0 }
  const { error } = await ctx.supabase.from('businesses').update({ catalogue_link_url: link.url, catalogue_mode: mode }).eq('id', ctx.businessId)
  if (error) {
    return {
      error: noFallbackColumns(error.message) ? 'This needs a database update first: run supabase/updates/2026-10-30_catalogue_fallback.sql in Supabase.' : error.message,
      nonce: 0,
    }
  }
  revalidatePath('/menu')
  revalidatePath('/settings/menu')
  return { error: null, nonce: Date.now() }
}

/** Deletes the old PDF from storage (best effort), unless it's the one now in use. */
async function removeFile(supabase: any, oldUrl: string | null | undefined, keepUrl: string | null) {
  if (!oldUrl || oldUrl === keepUrl) return
  const path = catalogueFilePath(oldUrl, SUPABASE_URL)
  if (!path) return
  const { error } = await supabase.storage.from(CATALOGUE_BUCKET).remove([path])
  if (error) console.error('Could not delete the old catalogue:', error.message)
}
