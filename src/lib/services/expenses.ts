import { expandExpenses, type ExpenseEntry, type ExpenseRecord } from '@/lib/expenses'

type Client = any

/**
 * Expenses that can fall between two dates: one-offs dated in the range, and
 * every repeating expense that started by the end of it. Returns [] (not an
 * error) on a database without the expenses table yet, so sales reports keep
 * working until the update is run; Settings → System says when it's missing.
 */
export async function getExpenseRecords(supabase: Client, businessId: string, from: string, to: string): Promise<ExpenseRecord[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, expense_date, amount, category, note, repeats_monthly, ends_on')
    .eq('business_id', businessId)
    .lte('expense_date', to)
    .or(`repeats_monthly.eq.true,expense_date.gte.${from}`)
    .order('expense_date', { ascending: true })
  if (error) {
    console.error('Could not load expenses:', error.message)
    return []
  }
  return (data ?? []).map(
    (r: { id: string; expense_date: string; amount: number; category: ExpenseRecord['category']; note: string | null; repeats_monthly: boolean; ends_on: string | null }) => ({
      id: r.id,
      expenseDate: r.expense_date,
      amount: Number(r.amount),
      category: r.category,
      note: r.note,
      repeatsMonthly: r.repeats_monthly,
      endsOn: r.ends_on,
    })
  )
}

/** Every expense entry between two dates (inclusive), repeating ones expanded month by month. */
export async function getExpenseEntries(supabase: Client, businessId: string, from: string, to: string): Promise<ExpenseEntry[]> {
  return expandExpenses(await getExpenseRecords(supabase, businessId, from, to), from, to)
}
