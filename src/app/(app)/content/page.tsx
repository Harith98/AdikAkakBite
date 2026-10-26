import { productThumbUrl } from '@/lib/product-images'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getReadyStock } from '@/lib/services/products'
import { getCompletedOrdersInRange } from '@/lib/services/orders'
import { addDaysISO, getBusinessNow } from '@/lib/time'
import {
  bestStreak,
  CHECKLIST_PLATFORMS,
  isCompleteDay,
  platformsForDay,
  PLATFORM_LABELS,
  postingStreak,
  postSuggestion,
  type ChecklistPlatform,
} from '@/lib/content'
import type { ContentPlatform } from '@/lib/supabase/database.types'
import { Card } from '@/components/ui/Card'
import { PlatformIcon } from '@/components/content/PlatformIcon'
import { PostingChecklist } from '@/components/content/PostingChecklist'
import { SavedCaptions } from '@/components/content/SavedCaptions'

/** How far back streaks look: 330 days × 3 platforms stays under 1000 rows. */
const STREAK_WINDOW_DAYS = 330

export default async function ContentPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const now = getBusinessNow(settings.timezone)
  const supabase = createClient()

  const [postsRes, readyStock, recentSales, captionsRes] = await Promise.all([
    // Checklist ticks (up to 3 a day) for the past year: streaks and this month's
    // summary, kept under Supabase's 1000-rows-per-request limit.
    supabase
      .from('content_items')
      .select('platform, content_date, created_at')
      .eq('business_id', business.id)
      .eq('status', 'posted')
      .in('platform', [...CHECKLIST_PLATFORMS])
      .gte('content_date', addDaysISO(now.isoDate, -(STREAK_WINDOW_DAYS - 1)))
      .lte('content_date', now.isoDate)
      .order('created_at', { ascending: true }),
    // Optional extras for the suggestion: never let them take the page down.
    getReadyStock(supabase, business.id).catch(() => []),
    getCompletedOrdersInRange(supabase, business.id, addDaysISO(now.isoDate, -29), now.isoDate).catch(() => []),
    // Most used first. Errors (no table before the database update) just hide the list.
    supabase
      .from('saved_captions')
      .select('id, title, body')
      .eq('business_id', business.id)
      .order('use_count', { ascending: false })
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ])
  const rows = postsRes.data ?? []

  const postedByDay = new Map<string, Set<ContentPlatform>>()
  for (const row of rows) {
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
  const best = Math.max(bestStreak(postedByDay), streak)

  // ---- This month so far ----
  const monthDays = Array.from({ length: Number(now.isoDate.slice(8, 10)) }, (_, i) => `${now.isoDate.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`)
  const fullDays = monthDays.filter((d) => isCompleteDay(d, postedByDay)).length
  // Per platform, out of the days it was on the checklist (Threads joined mid-month).
  const platformMonth = (platform: ChecklistPlatform) => {
    const counted = monthDays.filter((d) => platformsForDay(d).includes(platform))
    return { posted: counted.filter((d) => postedByDay.get(d)?.has(platform)).length, of: counted.length }
  }
  const monthName = new Date(`${now.isoDate}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long' })

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title="Content" subtitle="Post on each platform every day, then tick it off." />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
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

          {!captionsRes.error && (
            <Card>
              <SavedCaptions captions={captionsRes.data ?? []} />
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <SectionLabel icon="📊">{monthName} so far</SectionLabel>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-card bg-amber-soft px-1 py-2">
                <p className="font-display text-xl text-ink">🔥 {streak}</p>
                <p className="text-[11px] text-ink-muted">day streak</p>
              </div>
              <div className="rounded-card bg-sage-soft px-1 py-2">
                <p className="font-display text-xl text-ink">
                  {fullDays}
                  <span className="text-sm text-ink-muted">/{monthDays.length}</span>
                </p>
                <p className="text-[11px] text-ink-muted">days all posted</p>
              </div>
              <div className="rounded-card bg-base-soft px-1 py-2">
                <p className="font-display text-xl text-ink">🏅 {best}</p>
                <p className="text-[11px] text-ink-muted">best streak</p>
              </div>
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {CHECKLIST_PLATFORMS.map((platform) => {
                const { posted: days, of } = platformMonth(platform)
                return (
                  <li key={platform} className="flex items-center gap-3 text-sm">
                    <PlatformIcon platform={platform} size={22} />
                    <span className="w-20 shrink-0 text-ink">{PLATFORM_LABELS[platform]}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-pill bg-ink/10">
                      <span className="block h-full rounded-pill bg-sage-dark" style={{ width: `${of > 0 ? (days / of) * 100 : 0}%` }} />
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs text-ink-muted">
                      {days} day{days === 1 ? '' : 's'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <p className="text-xs text-ink-muted">
            Ticks are shared with the whole team. If anything isn&apos;t ticked by 8pm, you&apos;ll get a reminder (turn it off in Settings →
            Notifications).
          </p>
        </div>
      </div>
    </div>
  )
}
