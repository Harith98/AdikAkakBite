import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getTodayData } from '@/lib/services/today'
import { formatTime12, getBusinessNow } from '@/lib/time'
import { getBlockCandidates, getBlockProgress, getCurrentBlock, getNextBlock } from '@/lib/services/schedule'
import { getNextRecommendedTask, getOrderUrgency } from '@/lib/services/recommendation'
import { getSuggestedPriorities } from '@/lib/services/priorities'
import { getRecentCloses } from '@/lib/services/sales'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/LinkButton'
import { AddTaskForm } from '@/components/today/AddTaskForm'
import { AlertsCard } from '@/components/today/AlertsCard'
import { CurrentActivity } from '@/components/today/CurrentActivity'
import { OrderCard } from '@/components/today/OrderCard'
import { PrioritiesCard } from '@/components/today/PrioritiesCard'
import { LiveClock } from '@/components/today/LiveClock'

const MAX_ORDER_CARDS = 3

export default async function TodayPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()

  const now = getBusinessNow(settings.timezone)
  const isWorkingDay = settings.working_days.includes(now.isoWeekday)
  const isOpen =
    isWorkingDay &&
    now.time >= settings.working_hours_start.slice(0, 5) &&
    now.time < settings.working_hours_end.slice(0, 5)

  // The latest close is a tiny query, so fetch it alongside the main data
  // rather than waiting until we know whether the Closing block is active.
  const [data, latestClose] = await Promise.all([
    getTodayData(supabase, business.id, now.isoDate, isWorkingDay),
    isWorkingDay ? getRecentCloses(supabase, business.id, 1) : Promise.resolve([]),
  ])

  // ---- Orders, most pressing first (overdue, then by due date/time) ----
  const orderRows = data.orders
    .map((order) => ({ order, urgency: getOrderUrgency(order, now.isoDate, now.time) }))
    .sort((a, b) => Number(b.urgency.isOverdue) - Number(a.urgency.isOverdue))
  const hasUrgentOrder = orderRows.some((row) => row.urgency.isUrgent)

  // ---- Schedule + recommendation (deterministic, no AI) ----
  const engineInput = {
    today: now.isoDate,
    time: now.time,
    blocks: data.blocks,
    tasks: data.tasks,
    orders: data.orders,
    inventoryAlerts: data.inventoryAlerts,
  }
  const recommendation = getNextRecommendedTask(engineInput)
  const block = getCurrentBlock(data.blocks, now.time)
  const nextBlock = getNextBlock(data.blocks, now.time)
  const blockTasks = block ? getBlockCandidates(block, data.tasks, now.isoDate) : []
  const progress = block ? getBlockProgress(block, blockTasks, now.time) : null
  const focusTask = recommendation.taskId ? data.tasks.find((t) => t.id === recommendation.taskId) ?? null : null

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
  const todaysTasks = data.tasks.filter((t) => t.scheduledDate === now.isoDate)
  const tasksDone = todaysTasks.filter((t) => t.status === 'completed' || t.status === 'skipped').length
  const ordersToday = data.orders.filter((o) => o.requiredDate === now.isoDate).length

  // Nudge toward the daily close once Closing is the active block (spec §8/§61), unless already done.
  const isClosingBlock = block?.title.toLowerCase() === 'closing'
  const closedToday = latestClose.some((c) => c.review_date === now.isoDate)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-display text-3xl text-ink">
  {greeting(now.time)}, {business.owner_name ?? 'there'}! 👋
</p>
        <p className="mt-1 text-sm text-ink-muted">
          {now.dateLabel} · <LiveClock timezone={settings.timezone} initialTime={formatTime12(now.time)} />
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={isOpen ? 'sage' : 'neutral'}>{isOpen ? '🟢 Open' : '⚪ Closed'}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Orders due today" value={String(ordersToday)} />
          <Stat label="Tasks done" value={todaysTasks.length > 0 ? `${tasksDone}/${todaysTasks.length}` : '—'} />
          <Stat label="Low stock" value={String(data.inventoryAlerts.length)} />
        </div>
      </header>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col gap-6">
          {orderRows.length > 0 && (
            <section aria-label="Orders that need you" className="flex flex-col gap-3">
              {orderRows.slice(0, MAX_ORDER_CARDS).map(({ order, urgency }) => (
                <OrderCard key={order.id} order={order} urgency={urgency} today={now.isoDate} currency={settings.currency} />
              ))}
              {orderRows.length > MAX_ORDER_CARDS && (
                <p className="text-sm text-ink-muted">+ {orderRows.length - MAX_ORDER_CARDS} more orders due</p>
              )}
            </section>
          )}

          {isWorkingDay ? (
            <CurrentActivity
              time={now.time}
              block={block}
              blockTasks={blockTasks}
              progress={progress}
              recommendation={recommendation}
              focusTask={focusTask}
              deprioritized={hasUrgentOrder}
              nextBlock={nextBlock}
            />
          ) : null}

          {isWorkingDay && isClosingBlock && (
            <Card className={closedToday ? 'border border-sage/40' : 'border-2 border-raspberry'}>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                {closedToday ? "Today's close is saved" : 'Wrap up the day'}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {closedToday
                  ? 'You can still update the waste value or notes if anything changes.'
                  : 'Record any waste for today — revenue and orders are saved automatically.'}
              </p>
              <LinkButton href="/business/sales" className="mt-3">
                {closedToday ? 'Review close' : 'Close today'}
              </LinkButton>
            </Card>
          )}

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
          <PrioritiesCard priorities={priorities} suggestions={suggestions} />
          <AlertsCard alerts={data.inventoryAlerts} />
          <AddTaskForm />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-base-card p-3 shadow-card">
      <p className="font-display text-2xl text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
    </div>
  )
}

function greeting(time: string): string {
  const hour = Number(time.slice(0, 2))
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
