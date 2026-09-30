import { createClient } from '@/lib/supabase/server'
import { isAppSetUp } from '@/lib/services/setup'
import { safeNextPath } from '@/lib/validation/common'
import { LoginForm } from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNextPath(searchParams.next)
  // Invite links never need the check: their signup link is always offered.
  const isSetUp = next.startsWith('/invite/') ? true : await isAppSetUp(createClient())
  return <LoginForm next={next} isSetUp={isSetUp} />
}
