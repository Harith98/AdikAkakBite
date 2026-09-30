'use server'

import { revalidatePath } from 'next/cache'
import { getActionContext } from '@/lib/services/action-context'
import { canManageRole, isMemberRole } from '@/lib/team'
import { str, UUID_PATTERN } from '@/lib/validation/common'

export interface ActionResult {
  error: string | null
}

export interface InviteState {
  error: string | null
  /** Set on success so the form can show the link to share. */
  token: string | null
  email: string | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Create an invite link for an email + role (owners: admin/staff, admins: staff). */
export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const fail = (error: string): InviteState => ({ error, token: null, email: null })
  const email = str(formData, 'email').toLowerCase()
  const role = str(formData, 'role')

  if (!EMAIL_PATTERN.test(email) || email.length > 200) return fail('Enter a valid email address.')
  if (!isMemberRole(role)) return fail('Pick a role.')

  const ctx = await getActionContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, businessId, userId } = ctx
  if (!canManageRole(ctx.role, role)) return fail("You can't invite someone with that role.")

  const { data: members, error: membersError } = await supabase.rpc('get_business_members', { p_business_id: businessId })
  if (membersError) return fail(membersError.message)
  if ((members ?? []).some((m: { email: string }) => m.email.toLowerCase() === email)) {
    return fail('That person is already on your team.')
  }

  // An expired, unused invite would otherwise block a fresh one for the same email.
  await supabase
    .from('business_invitations')
    .delete()
    .eq('business_id', businessId)
    .eq('email', email)
    .is('accepted_at', null)
    .lt('expires_at', new Date().toISOString())

  const { data, error } = await supabase
    .from('business_invitations')
    .insert({ business_id: businessId, email, role, invited_by: userId })
    .select('token')
    .single()
  if (error) {
    if (error.code === '23505') return fail('There is already an open invite for that email. Copy or cancel it below.')
    return fail(error.message)
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: 'member_invited',
    entity_type: 'business_invitation',
    metadata: { email, role },
  })

  revalidatePath('/settings/team')
  return { error: null, token: data.token, email }
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(invitationId)) return { error: 'Invalid invitation.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }

  const { data, error } = await ctx.supabase
    .from('business_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('business_id', ctx.businessId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: "That invitation couldn't be cancelled." }

  revalidatePath('/settings/team')
  return { error: null }
}

export async function changeMemberRole(memberId: string, role: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(memberId)) return { error: 'Invalid member.' }
  if (!isMemberRole(role)) return { error: 'Pick a role.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  if (!canManageRole(ctx.role, role)) return { error: "You can't give someone that role." }

  // RLS also checks the member's CURRENT role, so an admin can't re-role another admin.
  const { data, error } = await ctx.supabase
    .from('business_members')
    .update({ role })
    .eq('id', memberId)
    .eq('business_id', ctx.businessId)
    .select('id, user_id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: "You can't change that person's role." }

  await ctx.supabase.from('business_activity_logs').insert({
    business_id: ctx.businessId,
    user_id: ctx.userId,
    action: 'member_role_changed',
    entity_type: 'business_member',
    entity_id: data.user_id,
    metadata: { role },
  })

  revalidatePath('/settings', 'layout')
  return { error: null }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(memberId)) return { error: 'Invalid member.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }

  const { data, error } = await ctx.supabase
    .from('business_members')
    .delete()
    .eq('id', memberId)
    .eq('business_id', ctx.businessId)
    .neq('user_id', ctx.userId) // leaving yourself goes through leaveBusiness
    .select('id, user_id, role')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: "You can't remove that person." }

  await ctx.supabase.from('business_activity_logs').insert({
    business_id: ctx.businessId,
    user_id: ctx.userId,
    action: 'member_removed',
    entity_type: 'business_member',
    entity_id: data.user_id,
    metadata: { role: data.role },
  })

  revalidatePath('/settings/team')
  return { error: null }
}

/** Owner only: make another member the owner; the current owner becomes an admin. */
export async function transferOwnership(memberId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(memberId)) return { error: 'Invalid member.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  if (ctx.role !== 'owner') return { error: 'Only the current owner can transfer ownership.' }

  // The database function re-checks everything and swaps both roles atomically.
  const { error } = await ctx.supabase.rpc('transfer_business_ownership', { p_member_id: memberId })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { error: null }
}

/** Leave the business (anyone but an owner). Afterwards they see the No access page until invited again. */
export async function leaveBusiness(): Promise<ActionResult> {
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  if (ctx.role === 'owner') return { error: "Owners can't leave their own business." }

  await ctx.supabase.from('business_activity_logs').insert({
    business_id: ctx.businessId,
    user_id: ctx.userId,
    action: 'member_left',
    entity_type: 'business_member',
    entity_id: ctx.userId,
  })

  const { data, error } = await ctx.supabase
    .from('business_members')
    .delete()
    .eq('business_id', ctx.businessId)
    .eq('user_id', ctx.userId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: "Couldn't leave the business. Please try again." }

  return { error: null }
}
