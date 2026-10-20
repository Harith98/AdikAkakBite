'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActionContext } from '@/lib/services/action-context'
import { canManageBusiness } from '@/lib/team'
import { str } from '@/lib/validation/common'
import { normalizeSocialLink } from '@/lib/social'
import { AVATAR_BUCKET, avatarFilePath, readAvatarUrl } from '@/lib/avatars'

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export interface BusinessDetailsState {
  error: string | null
  nonce: number
}

const LIMITS = { name: 120, ownerName: 120, phone: 30, email: 200, address: 300, registrationNumber: 50, receiptFooter: 300 } as const

/** Business name, owner name + the contact details printed on receipts (owners/admins). */
export async function updateBusinessDetails(_prev: BusinessDetailsState, formData: FormData): Promise<BusinessDetailsState> {
  const fail = (error: string): BusinessDetailsState => ({ error, nonce: 0 })
  const values = {
    name: str(formData, 'name'),
    ownerName: str(formData, 'ownerName'),
    phone: str(formData, 'phone'),
    email: str(formData, 'email'),
    address: str(formData, 'address'),
    registrationNumber: str(formData, 'registrationNumber'),
    receiptFooter: str(formData, 'receiptFooter'),
  }
  if (!values.name) return fail('Enter the business name.')
  for (const [key, max] of Object.entries(LIMITS)) {
    if (values[key as keyof typeof values].length > max) return fail('One of the fields is too long.')
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return fail('Enter a valid email address.')

  // Social pages for the customer menu: "@handle" or a link, stored as clean https links.
  const social: Partial<Record<'instagram_url' | 'facebook_url' | 'tiktok_url' | 'threads_url', string | null>> = {}
  for (const platform of ['instagram', 'facebook', 'tiktok', 'threads'] as const) {
    const raw = str(formData, platform)
    if (raw.length > 200) return fail('One of the social links is too long.')
    const result = normalizeSocialLink(platform, raw)
    if (!result.ok) return fail(result.error)
    social[`${platform}_url`] = result.url
  }
  // Only sent when there's something to save or clear, so details still save on a database without these columns yet.
  const { threads_url, ...older } = social
  const sendSocial = Object.values(older).some(Boolean) || formData.get('hadSocial') === '1'
  const sendThreads = Boolean(threads_url) || formData.get('hadThreads') === '1'

  const ctx = await getActionContext()
  if (!ctx.ok) return fail(ctx.error)
  if (!canManageBusiness(ctx.role)) return fail('Only owners and admins can change business details.')

  const { data, error } = await ctx.supabase
    .from('businesses')
    .update({
      name: values.name,
      owner_name: values.ownerName || null,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      registration_number: values.registrationNumber || null,
      receipt_footer: values.receiptFooter || null,
      ...(sendSocial ? older : {}),
      ...(sendThreads ? { threads_url } : {}),
    })
    .eq('id', ctx.businessId)
    .select('id')
    .maybeSingle()
  if (error) return fail(error.message)
  if (!data) return fail("Couldn't save the business details.")

  revalidatePath('/', 'layout')
  return { error: null, nonce: Date.now() }
}

export interface ProfileState {
  error: string | null
  nonce: number
}

/** Any team member: set the name the app greets you by and shows on the Team page. */
export async function updateMyName(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const name = str(formData, 'displayName')
  if (name.length > 80) return { error: 'Keep your name under 80 characters.', nonce: 0 }

  const supabase = createClient()
  // Stored in the auth user's own metadata, so each person manages only their own.
  const { error } = await supabase.auth.updateUser({ data: { display_name: name || null } })
  if (error) return { error: error.message, nonce: 0 }

  revalidatePath('/', 'layout')
  return { error: null, nonce: Date.now() }
}

/**
 * Any team member: set (or clear, with null) their own profile photo. The photo
 * is uploaded from the browser to their own avatars folder first; this saves
 * its link in their auth metadata and deletes the previous file.
 */
export async function updateMyAvatar(url: string | null): Promise<{ error: string | null }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (url !== null) {
    const path = avatarFilePath(url, supabaseUrl)
    if (!path || !path.startsWith(`${user.id}/`)) return { error: 'That photo couldn’t be used. Please try again.' }
  }

  const previous = readAvatarUrl(user.user_metadata)
  const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } })
  if (error) return { error: error.message }

  const oldPath = previous && previous !== url ? avatarFilePath(previous, supabaseUrl) : null
  if (oldPath) {
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([oldPath])
    if (removeError) console.error('Could not delete the old profile photo:', removeError.message)
  }

  revalidatePath('/', 'layout')
  return { error: null }
}
