import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { one } from './db-helpers'
import type { BusinessMemberRole, Database } from '@/lib/supabase/database.types'

type Business = Database['public']['Tables']['businesses']['Row']
type BusinessSettings = Database['public']['Tables']['business_settings']['Row']

/** Shape of the embedded select below (the hand-written types don't model relationships). */
interface MembershipWithBusiness {
  role: BusinessMemberRole
  business: (Business & { settings: BusinessSettings | BusinessSettings[] | null }) | null
}

export interface CurrentBusinessContext {
  business: Business
  settings: BusinessSettings
  userId: string
  role: BusinessMemberRole
}

/**
 * Resolves the signed-in user's business + settings for use in Server
 * Components and Route Handlers.
 *
 * V1 assumes one business per owner (spec §37 does not ask for multi-business
 * switching), so this takes the first business_members row for the user.
 * The schema already supports more than one via business_members, so a
 * business switcher can be added later without a migration.
 *
 * Redirects to onboarding if the user has no business yet (e.g. straight
 * after signup), and to /login if there is no session at all.
 */
export const getCurrentBusinessContext = cache(async (): Promise<CurrentBusinessContext> => {
  const supabase = createClient()

  // Middleware already called auth.getUser() for this request, which
  // contacts Supabase Auth to verify and refresh the token. Re-verifying
  // here would be a second network round trip for no extra safety, so we
  // read the already-validated session from cookies instead (no network
  // call). Do not use getSession() in code paths middleware doesn't cover.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) {
    redirect('/login')
  }

  // Membership, business and settings in ONE round trip via PostgREST
  // embedding (business_members → businesses → business_settings). Every
  // page runs this, so it's the hottest query in the app.
  const { data } = await supabase
    .from('business_members')
    .select('role, business:businesses(*, settings:business_settings(*))')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const membership = data as unknown as MembershipWithBusiness | null

  if (!membership) {
    redirect('/onboarding')
  }

  const businessRow = one(membership.business)
  const settings = one(businessRow?.settings)
  if (!businessRow || !settings) {
    redirect('/onboarding')
  }
  const business: Business = { ...businessRow }
  delete (business as Partial<typeof businessRow>).settings

  if (!settings.onboarding_completed) {
    redirect('/onboarding')
  }

  return { business, settings, userId: user.id, role: membership.role }
})
