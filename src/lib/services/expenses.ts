import { expandExpenses, type ExpenseEntry, type ExpenseRecord } from '@/lib/expenses'
import { fetchAllPages } from './db-helpers'

type Client = any

/**
 * Expenses that can fall between two dates: one-offs dated in the range, and
 * every repeating expense that started by the end of it. Returns [] on a
 * database without the expenses table yet (Settings → System says so); any
 * other failure throws, so net profit is never shown too high by mistake.
 */
export async function getExpenseRecords(supabase: Client, businessId: string, from: string, to: string): Promise<ExpenseRecord[]> {
  // Page by page, so a long range (e.g. a year of daily petrol) is never cut off.
  let data: unknown[]
  try {
    data = await fetchAllPages<unknown>((rangeFrom, rangeTo) =>
      supabase
        .from('expenses')
        .select('id, expense_date, amount, category, note, repeats_monthly, ends_on')
        .eq('business_id', businessId)
        .lte('expense_date', to)
        .or(`repeats_monthly.eq.true,expense_date.gte.${from}`)
        .order('expense_date', { ascending: true })
        .order('id')
        .range(rangeFrom, rangeTo)
    )
  } catch (e) {
    const message = (e as Error).message
    // Only a database without the expenses table yet counts as "no expenses";
    // any other failure must not quietly show net profit too high.
    if (/expenses/.test(message) && /does not exist|schema cache/i.test(message)) return []
    throw new Error(`Could not load expenses: ${message}`)
  }
  return (data as never[]).map(
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
