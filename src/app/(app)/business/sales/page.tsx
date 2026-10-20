import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getMonthSalesReport, getSalesSummary } from '@/lib/services/sales'
import { isMonthKey } from '@/lib/calc/sales'
import { MonthlyReport } from '@/components/business/MonthlyReport'
import { getBusinessNow } from '@/lib/time'
import { formatMoney } from '@/lib/constants'
import { Card } from '@/components/ui/Card'

export default async function SalesPage({ searchParams }: { searchParams: { month?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()
  const today = getBusinessNow(settings.timezone).isoDate
  const money = (n: number) => formatMoney(n, settings.currency)

  const currentMonth = today.slice(0, 7)
  // ?month=YYYY-MM picks the report's month; future months fall back to this one.
  const month = isMonthKey(searchParams.month) && searchParams.month <= currentMonth ? searchParams.month : currentMonth

  const [summary, monthReport] = await Promise.all([
    getSalesSummary(supabase, business.id, today),
    getMonthSalesReport(supabase, business.id, month),
  ])

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/business', label: 'Business' }} title="Sales" subtitle="Revenue is calculated live from completed orders." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summary.map((period) => (
          <Card key={period.label}>
            <SectionLabel icon="💰">{period.label}</SectionLabel>
            <p className="mt-1 font-display text-3xl text-ink">{money(period.totals.revenue)}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {period.totals.orders} order{period.totals.orders === 1 ? '' : 's'} · avg {money(period.totals.averageOrderValue)}
            </p>
          </Card>
        ))}
      </div>

      <MonthlyReport report={monthReport} currentMonth={currentMonth} money={money} />
    </div>
  )
}
