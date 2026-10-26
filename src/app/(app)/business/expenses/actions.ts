'use server'

import { revalidatePath } from 'next/cache'
import { getActionContext } from '@/lib/services/action-context'
import { parseExpenseForm } from '@/lib/expenses'
import { getBusinessNow } from '@/lib/time'
import { UUID_PATTERN } from '@/lib/validation/common'

export interface AddExpenseState {
  error: string | null
  nonce: number
}

export async function addExpense(_prev: AddExpenseState, formData: FormData): Promise<AddExpenseState> {
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  const parsed = parseExpenseForm(formData, getBusinessNow(ctx.timezone).isoDate)
  if (!parsed.ok) return { error: parsed.error, nonce: 0 }
  const e = parsed.value

  const { error } = await ctx.supabase.from('expenses').insert({
    business_id: ctx.businessId,
    expense_date: e.expenseDate,
    amount: e.amount,
    category: e.category,
    note: e.note,
    repeats_monthly: e.repeatsMonthly,
  })
  if (error) {
    return {
      error: /expenses/.test(error.message) && /exist|schema cache/i.test(error.message)
        ? 'Expenses need a database update first: run supabase/updates/2026-10-26_expenses.sql in Supabase.'
        : error.message,
      nonce: 0,
    }
  }
  revalidatePath('/business', 'layout')
  return { error: null, nonce: Date.now() }
}

export async function deleteExpense(formData: FormData): Promise<void> {
  const id = String(formData.get('expenseId') ?? '')
  if (!UUID_PATTERN.test(id)) return
  const ctx = await getActionContext()
  if (!ctx.ok) throw new Error(ctx.error)
  const { error } = await ctx.supabase.from('expenses').delete().eq('id', id).eq('business_id', ctx.businessId)
  if (error) throw new Error(error.message)
  revalidatePath('/business', 'layout')
}

/** Stops a repeating expense after this month: past months keep counting it, later ones don't. */
export async function stopRepeatingExpense(formData: FormData): Promise<void> {
  const id = String(formData.get('expenseId') ?? '')
  if (!UUID_PATTERN.test(id)) return
  const ctx = await getActionContext()
  if (!ctx.ok) throw new Error(ctx.error)
  const today = getBusinessNow(ctx.timezone).isoDate
  const [y, m] = today.split('-').map(Number)
  const endOfMonth = new Date(Date.UTC(y ?? 0, m ?? 1, 0)).toISOString().slice(0, 10)
  const { error } = await ctx.supabase
    .from('expenses')
    .update({ ends_on: endOfMonth })
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .eq('repeats_monthly', true)
  if (error) throw new Error(error.message)
  revalidatePath('/business', 'layout')
}
