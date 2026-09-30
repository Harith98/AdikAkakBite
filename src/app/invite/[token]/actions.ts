'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface AcceptInviteState {
  error: string | null
}

const TOKEN_PATTERN = /^[0-9a-f]{64}$/

export async function acceptInvitation(token: string, _prev: AcceptInviteState): Promise<AcceptInviteState> {
  if (!TOKEN_PATTERN.test(token)) return { error: 'This invitation link is not valid.' }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)

  // All checks (expiry, email match, one business per account) happen inside
  // the SECURITY DEFINER function, which raises a readable message on failure.
  const { error } = await supabase.rpc('accept_business_invitation', { p_token: token })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/today')
}

/** Signed in with the wrong account: sign out and come back to this invite. */
export async function switchAccount(token: string): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect(TOKEN_PATTERN.test(token) ? `/login?next=${encodeURIComponent(`/invite/${token}`)}` : '/login')
}
