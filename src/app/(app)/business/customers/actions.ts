'use server'

import { revalidatePath } from 'next/cache'
import { getActionContext } from '@/lib/services/action-context'
import { str } from '@/lib/validation/common'

export interface SaveCustomerState {
  error: string | null
  nonce: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function saveCustomer(_prev: SaveCustomerState, formData: FormData): Promise<SaveCustomerState> {
  const id = str(formData, 'customerId')
  const name = str(formData, 'name')
  const phone = str(formData, 'phone')
  const email = str(formData, 'email')
  const notes = str(formData, 'notes')

  if (!UUID.test(id)) return { error: 'Invalid customer.', nonce: 0 }
  if (!name) return { error: 'Enter a name.', nonce: 0 }
  if (name.length > 120 || phone.length > 30 || email.length > 200 || notes.length > 500) {
    return { error: 'One of the fields is too long.', nonce: 0 }
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }

  const { data, error } = await ctx.supabase
    .from('customers')
    .update({ name, phone: phone || null, email: email || null, notes: notes || null })
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message, nonce: 0 }
  if (!data) return { error: 'That customer could not be found.', nonce: 0 }

  revalidatePath('/business', 'layout')
  return { error: null, nonce: Date.now() }
}
