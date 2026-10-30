'use server'

import { revalidatePath } from 'next/cache'
import { getActionContext } from '@/lib/services/action-context'
import { parseExpenseForm, planAmountChange } from '@/lib/expenses'
import { getBusinessNow } from '@/lib/time'
import { parseMoney, UUID_PATTERN } from '@/lib/validation/common'

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

export interface ChangeAmountState {
  error: string | null
  nonce: number
}

/**
 * A monthly cost's new amount from this month (rent went up). Earlier months
 * keep the old amount; this month and later use the new one; no month counts
 * both (see planAmountChange).
 */
export async function changeMonthlyAmount(_prev: ChangeAmountState, formData: FormData): Promise<ChangeAmountState> {
  const id = String(formData.get('expenseId') ?? '')
  if (!UUID_PATTERN.test(id)) return { error: 'Invalid expense.', nonce: 0 }
  const amount = parseMoney(String(formData.get('amount') ?? ''), 'Amount')
  if (!amount.ok) return { error: amount.error, nonce: 0 }
  if (amount.value <= 0) return { error: 'Enter the new monthly amount.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  const { supabase, businessId } = ctx
  const today = getBusinessNow(ctx.timezone).isoDate

  const { data: current, error: findError } = await supabase
    .from('expenses')
    .select('id, expense_date, amount, category, note, repeats_monthly, ends_on')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle()
  if (findError) return { error: findError.message, nonce: 0 }
  if (!current || !current.repeats_monthly) return { error: 'That monthly cost could not be found.', nonce: 0 }
  if (current.ends_on) return { error: 'This monthly cost has been stopped. Add the new amount as a new monthly cost.', nonce: 0 }
  if (Number(current.amount) === amount.value) return { error: 'That’s the same amount as now.', nonce: 0 }

  const plan = planAmountChange(current.expense_date, today)
  if (plan.mode === 'in-place') {
    const { error } = await supabase.from('expenses').update({ amount: amount.value }).eq('id', id).eq('business_id', businessId)
    if (error) return { error: error.message, nonce: 0 }
  } else {
    // New amount first, then end the old one; if ending it fails, remove the new one again (no month counted twice).
    const { data: added, error: addError } = await supabase
      .from('expenses')
      .insert({
        business_id: businessId,
        expense_date: plan.newStart,
        amount: amount.value,
        category: current.category,
        note: current.note,
        repeats_monthly: true,
      })
      .select('id')
      .single()
    if (addError) return { error: addError.message, nonce: 0 }
    const { error: endError } = await supabase.from('expenses').update({ ends_on: plan.oldEndsOn }).eq('id', id).eq('business_id', businessId)
    if (endError) {
      await supabase.from('expenses').delete().eq('id', added.id).eq('business_id', businessId)
      return { error: `Couldn’t change it (${endError.message}). Nothing was changed.`, nonce: 0 }
    }
  }
  revalidatePath('/business', 'layout')
  return { error: null, nonce: Date.now() }
}
