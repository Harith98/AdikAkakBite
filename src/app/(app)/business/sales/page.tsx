import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getMonthSalesReport, getRecentCloses, getSalesSummary } from '@/lib/services/sales'
import { isMonthKey } from '@/lib/calc/sales'
import { MonthlyReport } from '@/components/business/MonthlyReport'
import { getBusinessNow, formatDateShort } from '@/lib/time'
import { formatMoney } from '@/lib/constants'
import { Card } from '@/components/ui/Card'
import { CloseDayForm } from '@/components/business/CloseDayForm'

export default async function SalesPage({ searchParams }: { searchParams: { month?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()
  const today = getBusinessNow(settings.timezone).isoDate
  const money = (n: number) => formatMoney(n, settings.currency)

  const currentMonth = today.slice(0, 7)
  // ?month=YYYY-MM picks the report's month; future months fall back to this one.
  const month = isMonthKey(searchParams.month) && searchParams.month <= currentMonth ? searchParams.month : currentMonth

  const [summary, closes, monthReport] = await Promise.all([
    getSalesSummary(supabase, business.id, today),
    getRecentCloses(supabase, business.id),
    getMonthSalesReport(supabase, business.id, month),
  ])
  const closedToday = closes.some((c) => c.review_date === today)

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/business" className="text-sm text-ink-muted">← Business</Link>
        <p className="mt-2 font-display text-3xl text-ink">Sales</p>
        <p className="mt-1 text-sm text-ink-muted">Revenue is calculated live from completed orders.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summary.map((period) => (
          <Card key={period.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{period.label}</p>
            <p className="mt-1 font-display text-3xl text-ink">{money(period.totals.revenue)}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {period.totals.orders} order{period.totals.orders === 1 ? '' : 's'} · avg {money(period.totals.averageOrderValue)}
            </p>
          </Card>
        ))}
      </div>

      <MonthlyReport report={monthReport} currentMonth={currentMonth} money={money} />

      <Card>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
          {closedToday ? "Today's close (saved)" : "Close today"}
        </p>
        <p className="mb-3 text-sm text-ink-muted">Record any waste before you finish for the day. Revenue and orders are saved automatically.</p>
        <CloseDayForm alreadyClosed={closedToday} />
      </Card>

      {closes.length > 0 && (
        <Card>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Recent days</p>
          <ul className="flex flex-col gap-2 text-sm">
            {closes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="text-ink">{formatDateShort(c.review_date)}</span>
                <span className="text-ink-muted">
                  {money(c.revenue ?? 0)} · {c.orders_count ?? 0} orders
                  {c.waste_value ? ` · ${money(c.waste_value)} waste` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
