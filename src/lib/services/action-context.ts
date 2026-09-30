import { createClient } from '@/lib/supabase/server'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import type { BusinessMemberRole } from '@/lib/supabase/database.types'
import { one } from './db-helpers'

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

  // Membership + timezone in one round trip (business_members → businesses → business_settings).
  const { data } = await supabase
    .from('business_members')
    .select('business_id, role, business:businesses(settings:business_settings(timezone))')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const membership = data as {
    business_id: string
    role: BusinessMemberRole
    business: { settings: { timezone: string } | { timezone: string }[] | null } | null
  } | null
  if (!membership) return { ok: false, error: 'No business found for this account.' }
  const settings = one(one(membership.business)?.settings)

  return {
    ok: true,
    supabase,
    userId: user.id,
    businessId: membership.business_id,
    role: membership.role,
    timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
  }
}
