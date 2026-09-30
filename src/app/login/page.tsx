import { createClient } from '@/lib/supabase/server'
import { isAppSetUp } from '@/lib/services/setup'
import { safeNextPath } from '@/lib/validation/common'
import { LoginForm } from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  // Before first-time setup, offer the owner a way to create the business.
  const isSetUp = await isAppSetUp(createClient())
  return <LoginForm next={safeNextPath(searchParams.next)} isSetUp={isSetUp} />
}
