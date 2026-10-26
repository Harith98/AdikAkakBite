import Link from 'next/link'
import clsx from '@/lib/clsx'
import { monthRange, percentChange, shiftMonth } from '@/lib/calc/sales'
import { formatDateShort } from '@/lib/time'
import { expenseCategory } from '@/lib/expenses'
import type { MonthSalesReport } from '@/lib/services/sales'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'

interface Props {
  report: MonthSalesReport
  /** The current month (YYYY-MM): no stepping past it. */
  currentMonth: string
  /** YYYY-MM-DD, so the current month's downloads stop at today. */
  today: string
  money: (n: number) => string
  /** Owners and admins can download the month's reports. */
  canExport?: boolean
}

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/** A month of sales: totals vs the month before, sales per day, and best sellers. */
export function MonthlyReport({ report, currentMonth, today, money, canExport = false }: Props) {
  const { month, totals, profit, previous, days, topProducts, bestDay, wasteValue, overheads, netProfit } = report
  const change = percentChange(totals.revenue, previous.revenue)
  const isCurrent = month === currentMonth
  const peak = Math.max(...days.map((d) => d.revenue), 0)
  const hasSales = totals.orders > 0
  const nav = 'flex h-11 w-11 items-center justify-center rounded-pill bg-base-card text-lg text-ink shadow-card'

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <Link href={`/business/sales?month=${shiftMonth(month, -1)}`} aria-label="Previous month" className={nav} scroll={false}>
          ‹
        </Link>
        <div className="text-center">
          <SectionLabel icon="📊" className="justify-center">Monthly report</SectionLabel>
          <p className="font-display text-xl text-ink">{monthLabel(month)}</p>
        </div>
        {isCurrent ? (
          <span aria-hidden="true" className={clsx(nav, 'opacity-30')}>
            ›
          </span>
        ) : (
          <Link href={`/business/sales?month=${shiftMonth(month, 1)}`} aria-label="Next month" className={nav} scroll={false}>
            ›
          </Link>
        )}
      </div>

      <div className="mt-4 text-center">
        <p className="font-display text-4xl text-ink">{money(totals.revenue)}</p>
        <p className="mt-1 text-sm text-ink-muted">
          {totals.orders} order{totals.orders === 1 ? '' : 's'} · avg {money(totals.averageOrderValue)}
          {isCurrent && ' · so far'}
        </p>
        <p className="mt-1 text-sm">
          {change === null ? (
            <span className="text-ink-muted">No sales in {monthLabel(shiftMonth(month, -1))} to compare with</span>
          ) : (
            <span className={change >= 0 ? 'font-medium text-sage-dark' : 'font-medium text-clay-dark'}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs {monthLabel(shiftMonth(month, -1))} ({money(previous.revenue)})
            </span>
          )}
        </p>
      </div>

      {hasSales ? (
        <>
          {/* Gross profit: sales minus what the items sold cost to make. */}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-card bg-base-soft px-2 py-2.5">
              <p className="text-[11px] text-ink-muted">Sales</p>
              <p className="font-display text-base text-ink">{money(totals.revenue)}</p>
            </div>
            <div className="rounded-card bg-base-soft px-2 py-2.5">
              <p className="text-[11px] text-ink-muted">Costs</p>
              <p className="font-display text-base text-ink">− {money(profit.cost)}</p>
            </div>
            <div className={clsx('rounded-card px-2 py-2.5', profit.profit >= 0 ? 'bg-sage-soft' : 'bg-clay-soft')}>
              <p className="text-[11px] text-ink-muted">Profit{profit.margin !== null && ` · ${profit.margin}%`}</p>
              <p className={clsx('font-display text-base', profit.profit >= 0 ? 'text-sage-dark' : 'text-clay-dark')}>{money(profit.profit)}</p>
            </div>
          </div>
          {/* Net profit: gross profit minus overheads (Expenses). */}
          <Link
            href={`/business/expenses?month=${month}`}
            className="mt-2 flex items-center justify-between gap-3 rounded-card border border-ink/10 px-3 py-2.5 text-sm transition-colors hover:bg-base-soft"
          >
            <span className="min-w-0">
              <span className="block text-ink-muted">
                − Overheads <span className="text-ink">{money(overheads.total)}</span>
              </span>
              <span className="block truncate text-[11px] text-ink-faint">
                {overheads.byCategory.length > 0
                  ? overheads.byCategory.map((b) => `${expenseCategory(b.category).label} ${money(b.amount)}`).join(' · ')
                  : 'None recorded. Add rent, bills, petrol in Expenses →'}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[11px] text-ink-muted">Net profit</span>
              <span className={clsx('font-display text-lg', netProfit >= 0 ? 'text-sage-dark' : 'text-clay-dark')}>{money(netProfit)}</span>
            </span>
          </Link>
          {profit.missingCost.length > 0 && (
            <p className="mt-2 rounded-card bg-amber-soft px-3 py-2 text-xs text-amber-dark">
              ⚠️ {profit.missingCost.length} item{profit.missingCost.length === 1 ? ' has' : 's have'} no cost entered, so profit looks higher than it is:{' '}
              {profit.missingCost.slice(0, 4).join(', ')}
              {profit.missingCost.length > 4 && ` and ${profit.missingCost.length - 4} more`}. Add costs in{' '}
              <Link href="/business/products" className="font-medium underline">
                Products
              </Link>
              .
            </p>
          )}

          {/* Sales per day: one bar per day, height relative to the best day. */}
          <div className="mt-5">
            <div className="flex h-28 items-end gap-[2px]" role="img" aria-label={`Sales per day in ${monthLabel(month)}`}>
              {days.map((d) => (
                <div
                  key={d.date}
                  title={`${formatDateShort(d.date)}: ${money(d.revenue)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`}
                  className={clsx(
                    'min-w-0 flex-1 rounded-t-sm',
                    d.revenue > 0 ? (d.date === bestDay?.date ? 'bg-raspberry' : 'bg-raspberry/45') : 'bg-ink/10'
                  )}
                  style={{ height: d.revenue > 0 && peak > 0 ? `${Math.max(6, (d.revenue / peak) * 100)}%` : '2px' }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-ink-faint">
              <span>1</span>
              <span>{Math.ceil(days.length / 2)}</span>
              <span>{days.length}</span>
            </div>
            {bestDay && (
              <p className="mt-2 text-xs text-ink-muted">
                Best day: <span className="font-medium text-ink">{formatDateShort(bestDay.date)}</span> · {money(bestDay.revenue)}
              </p>
            )}
          </div>

          {topProducts.length > 0 && (
            <div className="mt-5">
              <SectionLabel icon="🏆">Best sellers</SectionLabel>
              <ol className="mt-2 flex flex-col gap-2 text-sm">
                {topProducts.map((p, index) => (
                  <li key={p.name} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-ink">
                      <span className="mr-2 text-ink-faint">{index + 1}.</span>
                      {p.name}
                    </span>
                    <span className="shrink-0 text-right text-ink-muted">
                      {p.quantity} sold · {money(p.revenue)}
                      <span className={clsx('block text-xs', p.profit === null ? 'text-ink-faint' : p.profit >= 0 ? 'text-sage-dark' : 'text-clay-dark')}>
                        {p.profit === null ? 'no cost entered' : `${money(p.profit)} profit`}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {wasteValue > 0 && (
            <p className="mt-4 text-sm text-ink-muted">
              Waste recorded in daily closes: <span className="font-medium text-clay-dark">{money(wasteValue)}</span>
            </p>
          )}
        </>
      ) : (
        <EmptyState compact className="mt-2" emoji="📭" title={`No completed orders${isCurrent ? ' yet' : ''}`} text="Sales show up here once orders are completed." />
      )}

      {canExport && hasSales && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          {(
            [
              ['finance-summary', '📊 Summary'],
              ['sales-detail', '🔎 Sales detail'],
            ] as const
          ).map(([kind, label]) => {
            const { start, end } = monthRange(month)
            return (
              <a
                key={kind}
                href={`/api/export/${kind}?from=${start}&to=${end < today ? end : today}`}
                download
                className="flex h-11 items-center justify-center rounded-pill border border-raspberry/20 bg-base-card text-sm font-medium text-raspberry-dark shadow-card hover:bg-base-soft"
              >
                {label} ↓
              </a>
            )
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        {canExport && hasSales && 'Sales detail lists every item behind these numbers, to check them. '}
        Sales count on the day an order is completed. Profit is sales minus what the products cost to make (each at the cost it had on
        the day of the sale); net profit also takes off the month&apos;s overheads from Expenses. Best-seller amounts are before order discounts and delivery fees.
      </p>
    </Card>
  )
}
