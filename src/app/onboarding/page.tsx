import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMembership, isAppSetUp } from '@/lib/services/setup'
import { OnboardingForm } from './OnboardingForm'

/**
 * First-time setup only. Once the business exists, this screen is closed:
 * members go to Today, everyone else to "No access".
 */
export default async function OnboardingPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (await hasMembership(supabase, user.id)) redirect('/today')
  if (await isAppSetUp(supabase)) redirect('/no-access')

  return <OnboardingForm />
}
