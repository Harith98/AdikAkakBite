'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getActionContext } from '@/lib/services/action-context'
import { canManageRole, generateTempPassword, isMemberRole, MIN_PASSWORD_LENGTH } from '@/lib/team'
import { str, UUID_PATTERN } from '@/lib/validation/common'

export interface ActionResult {
  error: string | null
}

/** Handed back once so the owner/admin can pass the sign-in details on. Never stored. */
export interface Credentials {
  name: string
  email: string
  password: string
}

export interface AddMemberState {
  error: string | null
  created: Credentials | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NO_ADMIN_KEY =
  'Team accounts can’t be managed yet: SUPABASE_SERVICE_ROLE_KEY isn’t set on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.'

/**
 * Owner/admin creates a team member's login directly — no email, no invite
 * link. The account is created already confirmed with a temporary password
 * the new person must change on first sign-in (must_change_password).
 *
 * Uses the service-role key (bypasses RLS), so the caller's right to hand out
 * this role is checked here first, with the same rules as the database.
 */
export async function addTeamMember(_prev: AddMemberState, formData: FormData): Promise<AddMemberState> {
  const fail = (error: string): AddMemberState => ({ error, created: null })
  const name = str(formData, 'name')
  const email = str(formData, 'email').toLowerCase()
  const role = str(formData, 'role')
  const password = String(formData.get('password') ?? '')

  if (!name) return fail('Enter their name.')
  if (name.length > 80) return fail('Keep the name under 80 characters.')
  if (!EMAIL_PATTERN.test(email) || email.length > 200) return fail('Enter a valid email address.')
  if (!isMemberRole(role)) return fail('Pick a role.')
  if (password.length < MIN_PASSWORD_LENGTH) return fail(`The temporary password needs at least ${MIN_PASSWORD_LENGTH} characters.`)

  const ctx = await getActionContext()
  if (!ctx.ok) return fail(ctx.error)
  const { supabase, businessId, userId } = ctx
  if (!canManageRole(ctx.role, role)) return fail("You can't add someone with that role.")

  const admin = createServiceRoleClient()
  if (!admin) return fail(NO_ADMIN_KEY)

  const metadata = { display_name: name, must_change_password: true }
  let newUserId: string
  let createdNow = false

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // ready to sign in — no confirmation email
    user_metadata: metadata,
  })

  if (created?.user) {
    newUserId = created.user.id
    createdNow = true
  } else if (createError && /already (been )?registered|already exists/i.test(createError.message)) {
    // A login with this email already exists (e.g. someone who left earlier).
    // Re-use it if it isn't on the team: fresh temporary password, then add it back.
    const existing = await findUserByEmail(admin, email)
    if (!existing) return fail('An account with this email already exists but couldn’t be found. Try again in a moment.')
    const { data: membership } = await admin.from('business_members').select('id').eq('user_id', existing).maybeSingle()
    if (membership) return fail('That person is already on your team.')
    const { error: updateError } = await admin.auth.admin.updateUserById(existing, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (updateError) return fail(updateError.message)
    newUserId = existing
  } else {
    return fail(createError?.message ?? 'Couldn’t create the account.')
  }

  const { error: memberError } = await admin.from('business_members').insert({ business_id: businessId, user_id: newUserId, role })
  if (memberError) {
    if (createdNow) await admin.auth.admin.deleteUser(newUserId) // don't leave a login with no access
    return fail(memberError.message)
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: 'member_added',
    entity_type: 'business_member',
    entity_id: newUserId,
    metadata: { email, role },
  })

  revalidatePath('/settings/team')
  return { error: null, created: { name, email, password } }
}

/** Owner/admin: give a team member a new temporary password (they must change it at next sign-in). */
export async function resetMemberPassword(memberId: string): Promise<ActionResult & { credentials: Credentials | null }> {
  const fail = (error: string) => ({ error, credentials: null })
  if (!UUID_PATTERN.test(memberId)) return fail('Invalid member.')
  const ctx = await getActionContext()
  if (!ctx.ok) return fail(ctx.error)

  const { data: member, error } = await ctx.supabase
    .from('business_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('business_id', ctx.businessId)
    .maybeSingle()
  if (error) return fail(error.message)
  if (!member || member.user_id === ctx.userId || !canManageRole(ctx.role, member.role)) {
    return fail("You can't reset that person's password.")
  }

  const admin = createServiceRoleClient()
  if (!admin) return fail(NO_ADMIN_KEY)

  const password = generateTempPassword()
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(member.user_id, {
    password,
    user_metadata: { must_change_password: true },
  })
  if (updateError) return fail(updateError.message)

  await ctx.supabase.from('business_activity_logs').insert({
    business_id: ctx.businessId,
    user_id: ctx.userId,
    action: 'member_password_reset',
    entity_type: 'business_member',
    entity_id: member.user_id,
  })

  const user = updated.user
  return {
    error: null,
    credentials: {
      name: (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? '',
      email: user?.email ?? '',
      password,
    },
  }
}

/** The admin API has no lookup-by-email, so page through users (fine at small-business scale). */
async function findUserByEmail(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  email: string
): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return null
    const match = data.users.find((u) => u.email?.toLowerCase() === email)
    if (match) return match.id
    if (data.users.length < 200) return null
  }
  return null
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

  // Their login only existed for this business, so delete it too: a removed
  // person can't sign in at all. Best-effort — without the admin key they
  // still lose all access (the membership above is gone).
  await createServiceRoleClient()?.auth.admin.deleteUser(data.user_id)

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

/** Leave the business (anyone but an owner). Afterwards they see the No access page until an owner/admin adds them back. */
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
