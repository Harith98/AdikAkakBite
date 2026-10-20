import Link from 'next/link'
import clsx from '@/lib/clsx'
import { percentChange, shiftMonth } from '@/lib/calc/sales'
import { formatDateShort } from '@/lib/time'
import type { MonthSalesReport } from '@/lib/services/sales'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'

interface Props {
  report: MonthSalesReport
  /** The current month (YYYY-MM): no stepping past it. */
  currentMonth: string
  money: (n: number) => string
}

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/** A month of sales: totals vs the month before, sales per day, and best sellers. */
export function MonthlyReport({ report, currentMonth, money }: Props) {
  const { month, totals, previous, days, topProducts, bestDay, wasteValue } = report
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
                    <span className="shrink-0 text-ink-muted">
                      {p.quantity} sold · {money(p.revenue)}
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

      <p className="mt-4 text-xs text-ink-muted">
        Sales count on the day an order is completed. Best-seller amounts are before order discounts and delivery fees.
      </p>
    </Card>
  )
}
