import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

export type ActionContext =
  | {
      ok: true
      supabase: SupabaseClient<Database>
      userId: string
      businessId: string
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
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
    timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
  }
}
