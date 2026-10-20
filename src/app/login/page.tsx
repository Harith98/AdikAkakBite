import { createClient } from '@/lib/supabase/server'
import { isAppSetUp } from '@/lib/services/setup'
import { safeNextPath } from '@/lib/validation/common'
import { LoginForm } from './LoginForm'

const FALLBACK_NAME = 'AdikAkak Bites'

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const supabase = createClient()
  // Before first-time setup, offer the owner a way to create the business.
  // The shop's name is public (it's on the customer menu), so it can greet people here too.
  const [isSetUp, menu] = await Promise.all([
    isAppSetUp(supabase),
    supabase.rpc('get_public_menu').then(
      (r) => r,
      () => null
    ),
  ])
  const name = (menu?.data as { name?: string } | null | undefined)?.name?.trim() || FALLBACK_NAME
  return <LoginForm next={safeNextPath(searchParams.next)} isSetUp={isSetUp} businessName={name} />
}
