import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getMonthSalesReport, getSalesSummary } from '@/lib/services/sales'
import { isMonthKey } from '@/lib/calc/sales'
import { MonthlyReport } from '@/components/business/MonthlyReport'
import { canManageBusiness } from '@/lib/team'
import { getBusinessNow } from '@/lib/time'
import { formatMoney } from '@/lib/constants'
import { Card } from '@/components/ui/Card'

export default async function SalesPage({ searchParams }: { searchParams: { month?: string } }) {
  const { business, settings, role } = await getCurrentBusinessContext()
  const supabase = createClient()
  const today = getBusinessNow(settings.timezone).isoDate
  const money = (n: number) => formatMoney(n, settings.currency)

  const currentMonth = today.slice(0, 7)
  // ?month=YYYY-MM picks the report's month; future months fall back to this one.
  const month = isMonthKey(searchParams.month) && searchParams.month <= currentMonth ? searchParams.month : currentMonth

  const [summary, monthReport] = await Promise.all([
    getSalesSummary(supabase, business.id, today),
    getMonthSalesReport(supabase, business.id, month, today),
  ])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader back={{ href: '/business', label: 'Business' }} title="Sales" subtitle="Revenue is calculated live from completed orders." />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          {summary.map((period) => (
            <Card key={period.label}>
              <SectionLabel icon="💰">{period.label}</SectionLabel>
              <p className="mt-1 break-words font-display text-2xl text-ink sm:text-3xl">{money(period.totals.revenue)}</p>
              <p className="mt-1 text-xs text-ink-muted sm:text-sm">
                {period.totals.orders} order{period.totals.orders === 1 ? '' : 's'} · avg {money(period.totals.averageOrderValue)}
              </p>
            </Card>
          ))}
        </div>

        <MonthlyReport report={monthReport} currentMonth={currentMonth} today={today} money={money} canExport={canManageBusiness(role)} />
      </div>
    </div>
  )
}
