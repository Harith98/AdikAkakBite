import { createClient } from '@/lib/supabase/server'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import type { BusinessMemberRole } from '@/lib/supabase/database.types'

export type ActionContext =
  | {
      ok: true
      supabase: any
      userId: string
      businessId: string
      role: BusinessMemberRole
      timezone: string
    }
  | { ok: false; error: string }

/**
 * Shared preamble for server actions: who is calling, which business are
 * they in, and what timezone does that business use. Every query made with
 * the returned client still goes through Row Level Security as this user.
 */
export async function getActionContext(): Promise<ActionContext> {
  const supabase = createClient()
  // Middleware already ran auth.getUser() for this request (a verified
  // round trip to Supabase Auth). Reading the session here is a local
  // cookie read, not a network call, so we avoid paying for that
  // verification twice per request.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership) return { ok: false, error: 'No business found for this account.' }

  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone')
    .eq('business_id', membership.business_id)
    .maybeSingle()

  return {
    ok: true,
    supabase,
    userId: user.id,
    businessId: membership.business_id,
    role: membership.role,
    timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
  }
}
