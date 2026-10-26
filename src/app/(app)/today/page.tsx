import Link from 'next/link'
import clsx from '@/lib/clsx'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getTodayData } from '@/lib/services/today'
import { formatTime12, getBusinessNow } from '@/lib/time'
import { getBlockProgress, getCurrentBlock, getUpcomingBlocks } from '@/lib/services/schedule'
import { getOrderUrgency } from '@/lib/services/recommendation'
import { getSuggestedPriorities } from '@/lib/services/priorities'
import { getReadyStock } from '@/lib/services/products'
import { getUpcomingOrders } from '@/lib/services/orders'
import { formatMoney } from '@/lib/constants'
import { addDaysISO } from '@/lib/time'
import { ComingUpCard } from '@/components/today/ComingUpCard'
import { dayHeadline, dayPart } from '@/lib/today-greeting'
import { ReadyStockStrip } from '@/components/business/ReadyStockStrip'
import { Card } from '@/components/ui/Card'
import { AlertsCard } from '@/components/today/AlertsCard'
import { CurrentActivity } from '@/components/today/CurrentActivity'
import { OrderCard } from '@/components/today/OrderCard'
import { TodayFocusCard } from '@/components/today/TodayFocusCard'
import { LiveClock } from '@/components/today/LiveClock'

const MAX_ORDER_CARDS = 3
/** How far ahead the "Coming up" card looks. */
const UPCOMING_DAYS = 7

export default async function TodayPage() {
  const { business, settings, role, displayName, avatarUrl } = await getCurrentBusinessContext()
  const supabase = createClient()
  // Greet each person by their own name; the business's owner name only ever stands in for the owner.
  const greetName = displayName ?? (role === 'owner' ? business.owner_name : null) ?? 'there'

  const now = getBusinessNow(settings.timezone)
  const isWorkingDay = settings.working_days.includes(now.isoWeekday)
  const isOpen =
    isWorkingDay &&
    now.time >= settings.working_hours_start.slice(0, 5) &&
    now.time < settings.working_hours_end.slice(0, 5)

  const [data, readyStock, upcoming] = await Promise.all([
    getTodayData(supabase, business.id, now.isoDate, isWorkingDay),
    // Optional extras: never let them take the Today page down.
    getReadyStock(supabase, business.id).catch(() => []),
    getUpcomingOrders(supabase, business.id, now.isoDate, addDaysISO(now.isoDate, UPCOMING_DAYS)).catch(() => []),
  ])

  // ---- Orders, most pressing first (overdue, then by due date/time) ----
  const orderRows = data.orders
    .map((order) => ({ order, urgency: getOrderUrgency(order, now.isoDate, now.time) }))
    .sort((a, b) => Number(b.urgency.isOverdue) - Number(a.urgency.isOverdue))

  // ---- Schedule + recommendation (deterministic, no AI) ----
  const engineInput = {
    today: now.isoDate,
    time: now.time,
    blocks: data.blocks,
    tasks: data.tasks,
    orders: data.orders,
    inventoryAlerts: data.inventoryAlerts,
  }
  const block = getCurrentBlock(data.blocks, now.time)
  const progress = block ? getBlockProgress(block, [], now.time) : null // time-based: no tasks to tick
  const upcomingBlocks = getUpcomingBlocks(data.blocks, now.time)
  // An order due soon comes before whatever the timetable says.
  const urgent = orderRows.find((row) => row.urgency.isUrgent)
  const orderFirst = urgent
    ? `${urgent.order.customerName ?? 'A walk-in'}'s order ${
        urgent.urgency.isOverdue
          ? 'is overdue.'
          : urgent.order.requiredTime
            ? `is due at ${formatTime12(urgent.order.requiredTime)}.`
            : 'is due today.'
      }`
    : null

  // ---- Today's three priorities ----
  const priorities = data.tasks
    .filter((t) => t.dailyPriorityRank !== null && t.scheduledDate === now.isoDate)
    .sort((a, b) => (a.dailyPriorityRank ?? 0) - (b.dailyPriorityRank ?? 0))
    .map((t) => ({ id: t.id, title: t.title, status: t.status, rank: t.dailyPriorityRank ?? 0 }))
  const suggestions = getSuggestedPriorities({
    ...engineInput,
    existingTitles: priorities.map((p) => p.title),
  })

  // ---- Summary tiles ----
  const ordersToday = data.orders.filter((o) => o.requiredDate === now.isoDate).length

  // ---- Header personality: time-of-day greeting + one line about the day ----
  const part = dayPart(now.time)
  const headline = dayHeadline({
    overdueOrders: orderRows.filter((row) => row.urgency.isOverdue).length,
    ordersDueToday: ordersToday,
    lowStock: data.inventoryAlerts.length,
    ordersComingUp: upcoming.length,
    isWorkingDay,
    isoDate: now.isoDate,
  })

  return (
    <div className="flex flex-col gap-6">
      <header className={clsx('relative overflow-hidden rounded-card p-5 shadow-card', part.wash)}>
        {/* soft decorative circles, and the time of day's own emoji */}
        <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/40" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 right-16 h-24 w-24 rounded-full bg-white/30" />
        <span aria-hidden="true" className="pointer-events-none absolute right-4 top-3 text-4xl opacity-80 sm:text-5xl">
          {part.emoji}
        </span>

        <div className="relative flex items-center gap-4">
          {/* Your own photo, with the shop's logo as a little badge; just the logo if there's no photo. */}
          <span className="relative h-14 w-14 shrink-0">
            {avatarUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt="" className="h-14 w-14 rounded-pill object-cover shadow-card ring-2 ring-white" />
                <span className="absolute -bottom-1 -right-1 h-6 w-6 overflow-hidden rounded-pill bg-white shadow-card ring-2 ring-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/iconAdik192x192.png?v=2" alt="" className="h-full w-full object-contain" />
                </span>
              </>
            ) : (
              <span className="block h-14 w-14 overflow-hidden rounded-card bg-white shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/iconAdik512x512.png?v=2" alt="" className="h-full w-full object-contain p-0.5" />
              </span>
            )}
          </span>
          <div className="min-w-0 pr-10">
            <p className="font-display text-2xl leading-tight text-ink sm:text-3xl">
              {part.greeting}, {greetName}!
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
              <span>
                {now.dateLabel} · <LiveClock timezone={settings.timezone} initialTime={formatTime12(now.time)} />
              </span>
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium',
                  isOpen ? 'bg-sage-dark text-white' : 'bg-white/70 text-ink-muted'
                )}
              >
                <span aria-hidden="true" className={clsx('h-1.5 w-1.5 rounded-full', isOpen ? 'animate-pulse bg-white' : 'bg-ink-faint')} />
                {isOpen ? 'Open' : 'Closed'}
              </span>
            </p>
          </div>
        </div>

        <p className="relative mt-3 rounded-card bg-white/60 px-3 py-2 text-sm font-medium text-ink backdrop-blur">{headline}</p>

        <div className="relative mt-3 grid grid-cols-3 gap-2">
          <Stat emoji="🧾" label="Orders today" value={String(ordersToday)} href="/orders" />
          <Stat emoji="📅" label={`Next ${UPCOMING_DAYS} days`} value={String(upcoming.length)} href="/orders" />
          <Stat
            emoji="📦"
            label="Low stock"
            value={String(data.inventoryAlerts.length)}
            href="/business/inventory"
            alert={data.inventoryAlerts.length > 0}
          />
        </div>
      </header>

      {/* Phones: what's ready to sell comes first, right under the greeting. */}
      <div className="md:hidden">
        <ReadyStockStrip items={readyStock} />
      </div>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col gap-6">
          {orderRows.length > 0 && (
            <section id="orders-due" aria-label="Orders that need you" className="flex scroll-mt-4 flex-col gap-3">
              {orderRows.slice(0, MAX_ORDER_CARDS).map(({ order, urgency }) => (
                <OrderCard key={order.id} order={order} urgency={urgency} today={now.isoDate} currency={settings.currency} />
              ))}
              {orderRows.length > MAX_ORDER_CARDS && (
                <p className="text-sm text-ink-muted">+ {orderRows.length - MAX_ORDER_CARDS} more orders due</p>
              )}
            </section>
          )}

          {isWorkingDay ? (
            <CurrentActivity time={now.time} block={block} progress={progress} upcoming={upcomingBlocks} orderFirst={orderFirst} />
          ) : null}

          <ComingUpCard orders={upcoming} today={now.isoDate} days={UPCOMING_DAYS} money={(n) => formatMoney(n, settings.currency)} />

          {!isWorkingDay && (
            <Card>
              <p className="font-display text-2xl text-ink">It&apos;s a day off</p>
              <p className="mt-1 text-sm text-ink-muted">
                Today isn&apos;t one of your working days. Any orders that are still open are shown above.
              </p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Wider screens: in the side column. Phones get it at the top instead (above). */}
          <div className="hidden md:block">
            <ReadyStockStrip items={readyStock} />
          </div>
          <TodayFocusCard priorities={priorities} suggestions={suggestions} />
          <AlertsCard alerts={data.inventoryAlerts} />
        </div>
      </div>
    </div>
  )
}

function Stat({ emoji, label, value, href, alert }: { emoji: string; label: string; value: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-1">
        <span aria-hidden="true" className="text-base leading-none">
          {emoji}
        </span>
        <span className={clsx('font-display text-2xl leading-none', alert ? 'text-clay-dark' : 'text-ink')}>{value}</span>
      </span>
      <span className={clsx('mt-1.5 block text-[11px] leading-tight', alert ? 'font-medium text-clay-dark' : 'text-ink-muted')}>{label}</span>
    </>
  )
  const className = clsx(
    'block rounded-card px-3 py-2.5 backdrop-blur',
    alert ? 'bg-clay-soft ring-1 ring-clay/40' : 'bg-white/70'
  )
  return href ? (
    <Link href={href} className={clsx(className, 'transition-transform active:scale-[0.97]')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
