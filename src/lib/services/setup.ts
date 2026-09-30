import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/**
 * This app runs a single business. Has it been created yet?
 *
 * Only the very first account (before setup) may create the business; after
 * that, people join by invitation. Fails CLOSED — if the check itself errors
 * (e.g. migration 0013 not applied yet), treat the app as set up, so an error
 * can never re-open business creation.
 */
export async function isAppSetUp(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data, error } = await supabase.rpc('app_is_set_up')
  if (error) {
    console.error('app_is_set_up check failed; assuming the app is set up:', error.message)
    return true
  }
  return data === true
}

/** Does this signed-in user already belong to the business? */
export async function hasMembership(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data } = await supabase.from('business_members').select('id').eq('user_id', userId).limit(1).maybeSingle()
  return data !== null
}
