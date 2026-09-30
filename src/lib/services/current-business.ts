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
  userEmail: string | null
  role: BusinessMemberRole
  /** The signed-in person's own name (auth user metadata), if they've set one. */
  displayName: string | null
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
 * Redirects to /no-access if the user isn't on the team (which in turn
 * forwards to first-time setup if no business exists yet), and to /login if
 * there is no session at all.
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
    // Not on the team. /no-access forwards to first-time setup if the
    // business doesn't exist yet.
    redirect('/no-access')
  }

  const businessRow = one(membership.business)
  const settings = one(businessRow?.settings)
  // A member whose business has no (completed) settings means first-time
  // setup failed part-way. Sending them to /onboarding would loop (it
  // forwards members back here), so surface it instead.
  if (!businessRow || !settings || !settings.onboarding_completed) {
    throw new Error('Your business setup is incomplete (settings are missing). Please contact support to finish it.')
  }
  const business: Business = { ...businessRow }
  delete (business as Partial<typeof businessRow>).settings

  return {
    business,
    settings,
    userId: user.id,
    userEmail: user.email ?? null,
    role: membership.role,
    displayName: readDisplayName(user.user_metadata),
  }
})

/** A person's own name lives in their auth user metadata (set in Settings → Your profile). */
export function readDisplayName(metadata: Record<string, unknown> | undefined): string | null {
  const value = metadata?.display_name
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
