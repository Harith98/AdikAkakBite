import Link from 'next/link'
import clsx from '@/lib/clsx'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getExpenseRecords, getRunningMonthlyCosts } from '@/lib/services/expenses'
import { expandExpenses, expenseCategory, summarizeExpenses } from '@/lib/expenses'
import { isMonthKey, monthRange, shiftMonth } from '@/lib/calc/sales'
import { formatMoney } from '@/lib/constants'
import { formatDateShort, getBusinessNow } from '@/lib/time'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { ChangeAmountButton, DeleteExpenseButton, ExpenseForm, StopRepeatingButton } from '@/components/business/ExpenseForm'

export const metadata = { title: 'Expenses' }

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

export default async function ExpensesPage({ searchParams }: { searchParams: { month?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const today = getBusinessNow(settings.timezone).isoDate
  const thisMonth = today.slice(0, 7)
  const month = isMonthKey(searchParams.month) && searchParams.month <= thisMonth ? searchParams.month : thisMonth
  const range = monthRange(month)
  const to = range.end < today ? range.end : today
  const money = (n: number) => formatMoney(n, settings.currency)

  const supabase = createClient()
  const [records, monthly] = await Promise.all([
    getExpenseRecords(supabase, business.id, range.start, to),
    // Monthly costs still running, including a new amount that starts later this month.
    getRunningMonthlyCosts(supabase, business.id, today),
  ])
  const entries = expandExpenses(records, range.start, to).reverse() // newest first
  const summary = summarizeExpenses(entries)
  // Monthly costs still running (rent, bills): managed here, not per month.
  const nav = 'flex h-9 w-9 items-center justify-center rounded-pill text-lg text-ink hover:bg-ink/5'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        back={{ href: '/business', label: 'Business' }}
        title="Expenses"
        subtitle="Overheads like rent, bills and petrol. Not ingredients or packaging: those are already in each product's cost."
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <SectionLabel icon="➕" className="mb-3">
            Add an expense
          </SectionLabel>
          <ExpenseForm today={today} />
        </Card>

        <div className="flex flex-col gap-6">
          {monthly.length > 0 && (
            <Card>
              <SectionLabel icon="🔁">Monthly costs</SectionLabel>
              <p className="mt-1 text-xs text-ink-muted">Counted every month on the same day. Amount changed (rent went up)? Tap Change: the new amount applies from this month, and earlier months keep the old one.</p>
              <ul className="mt-3 flex flex-col divide-y divide-ink/5">
                {monthly.map((r) => {
                  const c = expenseCategory(r.category)
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-base-soft text-xl">
                        {c.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{r.note || c.label}</span>
                        <span className="block text-xs text-ink-muted">
                          {money(r.amount)}/month · day {Number(r.expenseDate.slice(8))} ·{' '}
                          {r.expenseDate > today ? `starts ${formatDateShort(r.expenseDate)}` : `since ${formatDateShort(r.expenseDate)}`}
                          {r.endsOn && ` · ends ${formatDateShort(r.endsOn)}`}
                        </span>
                      </span>
                      {!r.endsOn && (
                        <span className="flex gap-1.5">
                          <StopRepeatingButton id={r.id} />
                        </span>
                      )}
                      {!r.endsOn && (
                        <span className="basis-full pl-[3.25rem]">
                          <ChangeAmountButton id={r.id} label={r.note || c.label} amount={r.amount} />
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between gap-2">
              <Link href={`/business/expenses?month=${shiftMonth(month, -1)}`} scroll={false} aria-label="Previous month" className={nav}>
                ‹
              </Link>
              <div className="text-center">
                <SectionLabel icon="🧾" className="justify-center">
                  Spent in
                </SectionLabel>
                <p className="font-display text-lg text-ink">{monthLabel(month)}</p>
              </div>
              {month < thisMonth ? (
                <Link href={`/business/expenses?month=${shiftMonth(month, 1)}`} scroll={false} aria-label="Next month" className={nav}>
                  ›
                </Link>
              ) : (
                <span aria-hidden="true" className={clsx(nav, 'opacity-30')}>
                  ›
                </span>
              )}
            </div>

            {entries.length === 0 ? (
              <EmptyState compact className="mt-2" emoji="🪙" title="Nothing spent" text={`No overheads recorded for ${monthLabel(month)}.`} />
            ) : (
              <>
                <p className="mt-3 text-center font-display text-3xl text-ink">{money(summary.total)}</p>
                {month === thisMonth && <p className="text-center text-xs text-ink-muted">so far this month</p>}

                {/* By type: one bar each, relative to the biggest. */}
                <ul className="mt-4 flex flex-col gap-2">
                  {summary.byCategory.map((b) => {
                    const c = expenseCategory(b.category)
                    return (
                      <li key={b.category} className="text-sm">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-ink">
                            {c.emoji} {c.label}
                          </span>
                          <span className="text-ink-muted">{money(b.amount)}</span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-pill bg-ink/5">
                          <span className="block h-full rounded-pill bg-raspberry/60" style={{ width: `${Math.max(4, (b.amount / summary.total) * 100)}%` }} />
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <ul className="mt-5 flex flex-col divide-y divide-ink/5 border-t border-ink/5">
                  {entries.map((e) => {
                    const c = expenseCategory(e.category)
                    return (
                      <li key={`${e.expenseId}-${e.date}`} className="flex items-center gap-3 py-2.5">
                        <span aria-hidden="true" className="text-xl">
                          {c.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{e.note || c.label}</span>
                          <span className="block text-xs text-ink-muted">
                            {formatDateShort(e.date)}
                            {e.repeating && ' · 🔁 monthly'}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium text-ink">{money(e.amount)}</span>
                        <DeleteExpenseButton id={e.expenseId} repeating={e.repeating} />
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
