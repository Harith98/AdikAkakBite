'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActionContext } from '@/lib/services/action-context'
import { canManageBusiness } from '@/lib/team'
import { str } from '@/lib/validation/common'

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export interface BusinessDetailsState {
  error: string | null
  nonce: number
}

const LIMITS = { name: 120, phone: 30, email: 200, address: 300, registrationNumber: 50, receiptFooter: 300 } as const

/** Business name + the contact details printed on receipts (owners/admins). */
export async function updateBusinessDetails(_prev: BusinessDetailsState, formData: FormData): Promise<BusinessDetailsState> {
  const fail = (error: string): BusinessDetailsState => ({ error, nonce: 0 })
  const values = {
    name: str(formData, 'name'),
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

  const ctx = await getActionContext()
  if (!ctx.ok) return fail(ctx.error)
  if (!canManageBusiness(ctx.role)) return fail('Only owners and admins can change business details.')

  const { data, error } = await ctx.supabase
    .from('businesses')
    .update({
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      registration_number: values.registrationNumber || null,
      receipt_footer: values.receiptFooter || null,
    })
    .eq('id', ctx.businessId)
    .select('id')
    .maybeSingle()
  if (error) return fail(error.message)
  if (!data) return fail("Couldn't save the business details.")

  revalidatePath('/', 'layout')
  return { error: null, nonce: Date.now() }
}
