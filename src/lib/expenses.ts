import type { ExpenseCategory } from '@/lib/supabase/database.types'
import { fail, isValidISODate, parseMoney, str, type FormSource, type ParseResult } from '@/lib/validation/common'

/**
 * Overheads: what the shop spends that isn't part of a product's cost.
 * Ingredients and packaging are deliberately NOT here — they're already in
 * each product's cost, so logging them would count them twice.
 */
export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; emoji: string; hint: string }[] = [
  { key: 'rent', label: 'Rent', emoji: '🏠', hint: 'Shop or kitchen rent' },
  { key: 'utilities', label: 'Utilities', emoji: '💡', hint: 'Electric, water, gas, internet' },
  { key: 'petrol', label: 'Petrol & delivery', emoji: '⛽', hint: 'Petrol, tolls, parking, rider fees' },
  { key: 'equipment', label: 'Equipment', emoji: '🍳', hint: 'Oven, mixer, tins, tools' },
  { key: 'marketing', label: 'Marketing & ads', emoji: '📣', hint: 'Boosted posts, flyers, giveaways' },
  { key: 'other', label: 'Other', emoji: '🧾', hint: 'Anything else' },
]

const LABELS = new Map(EXPENSE_CATEGORIES.map((c) => [c.key, c]))
export const expenseCategory = (key: ExpenseCategory) => LABELS.get(key) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]!
export const isExpenseCategory = (value: string): value is ExpenseCategory => LABELS.has(value as ExpenseCategory)

/** An expense as saved: a one-off, or a monthly one (e.g. rent) that repeats from its date until endsOn. */
export interface ExpenseRecord {
  id: string
  expenseDate: string
  amount: number
  category: ExpenseCategory
  note: string | null
  repeatsMonthly: boolean
  endsOn: string | null
}

/** One time money went out: a one-off, or one month of a repeating expense. */
export interface ExpenseEntry {
  expenseId: string
  date: string
  amount: number
  category: ExpenseCategory
  note: string | null
  repeating: boolean
}

const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, m ?? 1, 0)).getUTCDate()
}
const nextMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, m ?? 1, 1)).toISOString().slice(0, 7)
}

/**
 * Every expense entry dated between `from` and `to` (inclusive), oldest first.
 * A repeating expense falls on the same day each month (the last day in
 * shorter months: the 31st becomes the 30th or 28th), from its start until
 * endsOn.
 */
export function expandExpenses(records: ExpenseRecord[], from: string, to: string): ExpenseEntry[] {
  const entries: ExpenseEntry[] = []
  for (const r of records) {
    const base = { expenseId: r.id, amount: Number(r.amount), category: r.category, note: r.note, repeating: r.repeatsMonthly }
    if (!r.repeatsMonthly) {
      if (r.expenseDate >= from && r.expenseDate <= to) entries.push({ ...base, date: r.expenseDate })
      continue
    }
    const day = Number(r.expenseDate.slice(8, 10))
    const last = r.endsOn && r.endsOn < to ? r.endsOn : to
    let month = r.expenseDate.slice(0, 7) > from.slice(0, 7) ? r.expenseDate.slice(0, 7) : from.slice(0, 7)
    for (let guard = 0; month <= last.slice(0, 7) && guard < 1200; guard++, month = nextMonth(month)) {
      const date = `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`
      if (date >= r.expenseDate && date >= from && date <= last) entries.push({ ...base, date })
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
}

/**
 * Changing a monthly cost's amount (rent went up) "from this month":
 *   - it started this month: just change the amount (nothing to keep);
 *   - it started earlier: the old amount ends on the last day of last month,
 *     and the new amount starts this month on the same day of the month.
 * So every month counts exactly one amount: no month has both, none has neither.
 */
export function planAmountChange(
  startDate: string,
  today: string
): { mode: 'in-place' } | { mode: 'split'; oldEndsOn: string; newStart: string } {
  const month = today.slice(0, 7)
  const monthStart = `${month}-01`
  if (startDate >= monthStart) return { mode: 'in-place' }
  const [y, m] = month.split('-').map(Number)
  const lastOfPrevious = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, 0)).toISOString().slice(0, 10)
  const day = Math.min(Number(startDate.slice(8, 10)), daysInMonth(month))
  return { mode: 'split', oldEndsOn: lastOfPrevious, newStart: `${month}-${String(day).padStart(2, '0')}` }
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Total spent, and per category (biggest first, only categories with spending). */
export function summarizeExpenses(entries: ExpenseEntry[]): { total: number; byCategory: { category: ExpenseCategory; amount: number }[] } {
  const by = new Map<ExpenseCategory, number>()
  for (const e of entries) by.set(e.category, (by.get(e.category) ?? 0) + e.amount)
  return {
    total: round2(entries.reduce((sum, e) => sum + e.amount, 0)),
    byCategory: Array.from(by, ([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
  }
}

export interface ExpenseInput {
  expenseDate: string
  amount: number
  category: ExpenseCategory
  note: string | null
  repeatsMonthly: boolean
}

/** The add-expense form. Dates can't be in the future: an expense counts once it's paid. */
export function parseExpenseForm(form: FormSource, today: string): ParseResult<ExpenseInput> {
  const expenseDate = str(form, 'expenseDate')
  if (!isValidISODate(expenseDate)) return fail('Choose the date it was paid.')
  if (expenseDate > today) return fail('The date can’t be in the future. Add it once it’s paid.')
  const amount = parseMoney(str(form, 'amount'), 'Amount')
  if (!amount.ok) return amount
  if (amount.value <= 0) return fail('Enter how much it cost.')
  const category = str(form, 'category')
  if (!isExpenseCategory(category)) return fail('Choose what it was for.')
  const note = str(form, 'note')
  if (note.length > 200) return fail('Keep the note under 200 characters.')
  return {
    ok: true,
    value: { expenseDate, amount: amount.value, category, note: note || null, repeatsMonthly: form.get('repeatsMonthly') === 'on' },
  }
}
