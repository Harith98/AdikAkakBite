import { describe, it, expect } from 'vitest'
import { expandExpenses, parseExpenseForm, summarizeExpenses, type ExpenseRecord } from '@/lib/expenses'

const rec = (over: Partial<ExpenseRecord>): ExpenseRecord => ({
  id: 'x',
  expenseDate: '2026-09-05',
  amount: 100,
  category: 'other',
  note: null,
  repeatsMonthly: false,
  endsOn: null,
  ...over,
})
const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null })

describe('expandExpenses', () => {
  it('keeps one-offs inside the range only', () => {
    const e = expandExpenses([rec({ expenseDate: '2026-09-05' }), rec({ id: 'y', expenseDate: '2026-10-01' })], '2026-10-01', '2026-10-31')
    expect(e.map((x) => x.date)).toEqual(['2026-10-01'])
  })

  it('repeats monthly on the same day, from its start, until it ends', () => {
    const rent = rec({ id: 'rent', category: 'rent', amount: 400, expenseDate: '2026-08-10', repeatsMonthly: true, endsOn: '2026-11-30' })
    const e = expandExpenses([rent], '2026-01-01', '2026-12-31')
    expect(e.map((x) => x.date)).toEqual(['2026-08-10', '2026-09-10', '2026-10-10', '2026-11-10'])
    expect(e.every((x) => x.amount === 400 && x.repeating)).toBe(true)
  })

  it('does not count a month whose day has not come yet', () => {
    const rent = rec({ expenseDate: '2026-08-28', repeatsMonthly: true })
    expect(expandExpenses([rent], '2026-10-01', '2026-10-26')).toEqual([])
    expect(expandExpenses([rent], '2026-10-01', '2026-10-28')).toHaveLength(1)
  })

  it('uses the last day in shorter months', () => {
    const e = expandExpenses([rec({ expenseDate: '2026-01-31', repeatsMonthly: true })], '2026-01-01', '2026-04-30')
    expect(e.map((x) => x.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
})

describe('summarizeExpenses', () => {
  it('totals overall and per category, biggest first', () => {
    const s = summarizeExpenses([
      { expenseId: 'a', date: '2026-10-01', amount: 400, category: 'rent', note: null, repeating: true },
      { expenseId: 'b', date: '2026-10-03', amount: 30.5, category: 'petrol', note: null, repeating: false },
      { expenseId: 'c', date: '2026-10-09', amount: 20.25, category: 'petrol', note: null, repeating: false },
    ])
    expect(s).toEqual({ total: 450.75, byCategory: [{ category: 'rent', amount: 400 }, { category: 'petrol', amount: 50.75 }] })
  })
})

describe('parseExpenseForm', () => {
  const today = '2026-10-26'
  it('accepts a valid expense', () => {
    expect(parseExpenseForm(form({ expenseDate: '2026-10-20', amount: '1,200.50', category: 'rent', note: ' Kitchen ', repeatsMonthly: 'on' }), today)).toEqual({
      ok: true,
      value: { expenseDate: '2026-10-20', amount: 1200.5, category: 'rent', note: 'Kitchen', repeatsMonthly: true },
    })
  })

  it('refuses future dates, zero amounts and unknown types', () => {
    expect(parseExpenseForm(form({ expenseDate: '2026-10-27', amount: '10', category: 'rent' }), today).ok).toBe(false)
    expect(parseExpenseForm(form({ expenseDate: '2026-10-20', amount: '0', category: 'rent' }), today).ok).toBe(false)
    expect(parseExpenseForm(form({ expenseDate: '2026-10-20', amount: '10', category: 'flour' }), today).ok).toBe(false)
  })
})

describe('planAmountChange', () => {
  it('changes in place when the monthly cost only started this month', async () => {
    const { planAmountChange } = await import('@/lib/expenses')
    expect(planAmountChange('2026-10-05', '2026-10-30')).toEqual({ mode: 'in-place' })
  })

  it('ends the old amount last month and starts the new one this month, on the same day', async () => {
    const { planAmountChange, expandExpenses } = await import('@/lib/expenses')
    const plan = planAmountChange('2026-08-10', '2026-10-30')
    expect(plan).toEqual({ mode: 'split', oldEndsOn: '2026-09-30', newStart: '2026-10-10' })
    if (plan.mode !== 'split') return
    // Every month counts exactly one amount: never both, never neither.
    const months = expandExpenses(
      [
        { id: 'old', expenseDate: '2026-08-10', amount: 400, category: 'rent', note: null, repeatsMonthly: true, endsOn: plan.oldEndsOn },
        { id: 'new', expenseDate: plan.newStart, amount: 450, category: 'rent', note: null, repeatsMonthly: true, endsOn: null },
      ],
      '2026-08-01',
      '2026-12-31'
    ).map((e) => [e.date, e.amount])
    expect(months).toEqual([
      ['2026-08-10', 400],
      ['2026-09-10', 400],
      ['2026-10-10', 450],
      ['2026-11-10', 450],
      ['2026-12-10', 450],
    ])
  })

  it('keeps the day in shorter months', async () => {
    const { planAmountChange } = await import('@/lib/expenses')
    expect(planAmountChange('2026-01-31', '2026-02-15')).toEqual({ mode: 'split', oldEndsOn: '2026-01-31', newStart: '2026-02-28' })
  })
})
