import Link from 'next/link'
import { productThumbUrl } from '@/lib/product-images'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getReadyStock } from '@/lib/services/products'
import { getCompletedOrdersInRange } from '@/lib/services/orders'
import { addDaysISO, getBusinessNow } from '@/lib/time'
import { isMonthKey, monthRange, shiftMonth } from '@/lib/calc/sales'
import {
  bestStreak,
  CHECKLIST_PLATFORMS,
  isCompleteDay,
  PLATFORM_LABELS,
  postingStreak,
  postSuggestion,
  type ChecklistPlatform,
} from '@/lib/content'
import type { ContentPlatform } from '@/lib/supabase/database.types'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { PostingChecklist } from '@/components/content/PostingChecklist'

/** Each platform's own colour, for its dot in the calendar. */
const DOT: Record<ChecklistPlatform, string> = {
  instagram: 'bg-[#DD2A7B]',
  facebook: 'bg-[#1877F2]',
  whatsapp: 'bg-[#25D366]',
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
/** How far back streaks look: 330 days × 3 platforms stays under 1000 rows. */
const STREAK_WINDOW_DAYS = 330

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

export default async function ContentPage({ searchParams }: { searchParams: { month?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const now = getBusinessNow(settings.timezone)
  const thisMonth = now.isoDate.slice(0, 7)
  const month = isMonthKey(searchParams.month) && searchParams.month <= thisMonth ? searchParams.month : thisMonth
  const supabase = createClient()

  // Checklist ticks (up to 3 a day): the past year for the streaks, kept under
  // Supabase's 1000-rows-per-request limit, plus the month the calendar shows.
  const ticks = (from: string, to: string) =>
    supabase
      .from('content_items')
      .select('platform, content_date, created_at')
      .eq('business_id', business.id)
      .eq('status', 'posted')
      .in('platform', [...CHECKLIST_PLATFORMS])
      .gte('content_date', from)
      .lte('content_date', to)
      .order('created_at', { ascending: true })
  const range = monthRange(month)
  const [postsRes, monthRes, readyStock, recentSales] = await Promise.all([
    ticks(addDaysISO(now.isoDate, -(STREAK_WINDOW_DAYS - 1)), now.isoDate),
    ticks(range.start, range.end),
    // Optional extras for the suggestion: never let them take the page down.
    getReadyStock(supabase, business.id).catch(() => []),
    getCompletedOrdersInRange(supabase, business.id, addDaysISO(now.isoDate, -29), now.isoDate).catch(() => []),
  ])
  const rows = postsRes.data ?? []

  const postedByDay = new Map<string, Set<ContentPlatform>>()
  for (const row of [...rows, ...(monthRes.data ?? [])]) {
    const set = postedByDay.get(row.content_date) ?? new Set<ContentPlatform>()
    set.add(row.platform)
    postedByDay.set(row.content_date, set)
  }

  const timeFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const postedAt: Partial<Record<ChecklistPlatform, string>> = {}
  for (const row of rows) {
    if (row.content_date === now.isoDate && !postedAt[row.platform as ChecklistPlatform]) {
      postedAt[row.platform as ChecklistPlatform] = timeFormat.format(new Date(row.created_at))
    }
  }

  // ---- Streaks ----
  const earliest = rows[0]?.content_date ?? now.isoDate
  const backDays: string[] = []
  for (let day = now.isoDate; day >= earliest && backDays.length < 1000; day = addDaysISO(day, -1)) backDays.push(day)
  const streak = postingStreak(backDays, postedByDay)
  // Best within the past year (older months shown in the calendar don't count, so it's the same on every month).
  const yearByDay = new Map(Array.from(postedByDay).filter(([day]) => day >= addDaysISO(now.isoDate, -(STREAK_WINDOW_DAYS - 1))))
  const best = Math.max(bestStreak(yearByDay), streak)

  // ---- What to post today ----
  const sold = new Map<string, number>()
  for (const order of recentSales) {
    for (const item of order.order_items ?? []) sold.set(item.product_name, (sold.get(item.product_name) ?? 0) + item.quantity)
  }
  const top = Array.from(sold).sort((a, b) => b[1] - a[1])[0]
  const suggestion = postSuggestion({
    readyStock,
    bestSeller: top ? { name: top[0], quantity: top[1] } : null,
    isoDate: now.isoDate,
  })

  // ---- Month calendar (Monday first) ----
  const firstWeekday = (new Date(`${range.start}T00:00:00Z`).getUTCDay() + 6) % 7 // Mon = 0
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: range.days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]
  const pastDays = cells.filter((d): d is string => d !== null && d <= now.isoDate)
  const completeDays = pastDays.filter((d) => isCompleteDay(d, postedByDay)).length
  const nav = 'flex h-9 w-9 items-center justify-center rounded-pill text-lg text-ink hover:bg-ink/5'

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Content" subtitle="Post on each platform every day, then tick it off." />

      <Card className="!border-raspberry/20 !bg-raspberry-soft/40">
        <SectionLabel icon="💡">What to post today</SectionLabel>
        <div className="mt-3 flex items-start gap-3">
          {suggestion.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productThumbUrl(suggestion.imageUrl) ?? ''} alt="" className="h-16 w-16 shrink-0 rounded-card object-cover shadow-card" />
          ) : (
            <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-white text-3xl shadow-card">
              {suggestion.emoji}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight text-ink">{suggestion.title}</p>
            <p className="mt-1 text-sm text-ink-muted">{suggestion.text}</p>
          </div>
        </div>
      </Card>

      <Card>
        {/* key resets the ticks when the day changes */}
        <PostingChecklist key={now.isoDate} postedAt={postedAt} />
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <Link href={`/content?month=${shiftMonth(month, -1)}`} scroll={false} aria-label="Previous month" className={nav}>
            ‹
          </Link>
          <div className="text-center">
            <SectionLabel icon="📅" className="justify-center">Posting calendar</SectionLabel>
            <p className="font-display text-lg text-ink">{monthLabel(month)}</p>
          </div>
          {month < thisMonth ? (
            <Link href={`/content?month=${shiftMonth(month, 1)}`} scroll={false} aria-label="Next month" className={nav}>
              ›
            </Link>
          ) : (
            <span aria-hidden="true" className={clsx(nav, 'opacity-30')}>
              ›
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-card bg-amber-soft px-2 py-2">
            <p className="font-display text-xl text-ink">🔥 {streak}</p>
            <p className="text-[11px] text-ink-muted">day streak now</p>
          </div>
          <div className="rounded-card bg-sage-soft px-2 py-2">
            <p className="font-display text-xl text-ink">🏅 {best}</p>
            <p className="text-[11px] text-ink-muted">best streak this year</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="pb-1 text-[11px] font-medium text-ink-faint">
              {d}
            </span>
          ))}
          {cells.map((day, i) => {
            if (!day) return <span key={`blank-${i}`} />
            const future = day > now.isoDate
            const today = day === now.isoDate
            const posted = postedByDay.get(day)
            const complete = isCompleteDay(day, postedByDay)
            return (
              <span
                key={day}
                title={future ? undefined : `${CHECKLIST_PLATFORMS.filter((p) => posted?.has(p)).length} of ${CHECKLIST_PLATFORMS.length} posted`}
                className={clsx(
                  'flex aspect-square flex-col items-center justify-center gap-1 rounded-card text-xs',
                  complete ? 'bg-sage-soft text-ink' : future ? 'text-ink-faint' : 'bg-base-soft text-ink',
                  today && 'ring-2 ring-raspberry'
                )}
              >
                {Number(day.slice(8))}
                {!future && (
                  <span className="flex gap-0.5" aria-hidden="true">
                    {CHECKLIST_PLATFORMS.map((p) => (
                      <span key={p} className={clsx('h-1.5 w-1.5 rounded-pill', posted?.has(p) ? DOT[p] : 'bg-ink/10')} />
                    ))}
                  </span>
                )}
              </span>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
          <span className="flex flex-wrap gap-3">
            {CHECKLIST_PLATFORMS.map((p) => (
              <span key={p} className="flex items-center gap-1">
                <span className={clsx('h-2 w-2 rounded-pill', DOT[p])} aria-hidden="true" />
                {PLATFORM_LABELS[p]}
              </span>
            ))}
          </span>
          <span>
            {completeDays} of {pastDays.length} day{pastDays.length === 1 ? '' : 's'} fully posted
          </span>
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        Ticks are shared with the whole team. If anything isn&apos;t ticked by 8pm, you&apos;ll get a reminder (turn it off in Settings →
        Notifications).
      </p>
    </div>
  )
}
