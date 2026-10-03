import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { addDaysISO, getBusinessNow } from '@/lib/time'
import { CHECKLIST_PLATFORMS, PLATFORM_LABELS, postingStreak, type ChecklistPlatform } from '@/lib/content'
import type { ContentPlatform } from '@/lib/supabase/database.types'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { PlatformIcon } from '@/components/content/PlatformIcon'
import { PostingChecklist } from '@/components/content/PostingChecklist'

const WEEK = 7

export default async function ContentPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const now = getBusinessNow(settings.timezone)
  const days = Array.from({ length: WEEK }, (_, i) => addDaysISO(now.isoDate, -i)) // newest first

  const { data } = await createClient()
    .from('content_items')
    .select('platform, content_date, created_at')
    .eq('business_id', business.id)
    .eq('status', 'posted')
    .in('platform', [...CHECKLIST_PLATFORMS])
    .gte('content_date', days.at(-1) ?? now.isoDate)
    .lte('content_date', now.isoDate)
    .order('created_at', { ascending: true })
  const rows = data ?? []

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

  const streak = postingStreak(days, postedByDay)
  const weekdayLabel = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'narrow' })

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <p className="font-display text-3xl text-ink">Content</p>
        <p className="mt-1 text-sm text-ink-muted">Post on each platform every day, then tick it off.</p>
      </header>

      <Card>
        {/* key resets the ticks when the day changes */}
        <PostingChecklist key={now.isoDate} postedAt={postedAt} />
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Last 7 days</p>
          <p className="text-sm text-ink-muted">
            {streak > 0 ? `🔥 ${streak}-day streak` : 'Post on all three to start a streak'}
          </p>
        </div>
        <table className="mt-3 w-full table-fixed text-center text-xs">
          <thead>
            <tr>
              <th className="w-10" aria-label="Platform" />
              {[...days].reverse().map((day) => (
                <th key={day} className={clsx('pb-2 font-medium', day === now.isoDate ? 'text-ink' : 'text-ink-muted')}>
                  {day === now.isoDate ? 'Today' : weekdayLabel(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CHECKLIST_PLATFORMS.map((platform) => (
              <tr key={platform}>
                <th scope="row" className="py-1.5">
                  <PlatformIcon platform={platform} size={24} />
                  <span className="sr-only">{PLATFORM_LABELS[platform]}</span>
                </th>
                {[...days].reverse().map((day) => {
                  const done = postedByDay.get(day)?.has(platform) ?? false
                  return (
                    <td key={day} className="py-1.5">
                      <span
                        className={clsx(
                          'mx-auto block h-3.5 w-3.5 rounded-pill',
                          done ? 'bg-sage-dark' : day === now.isoDate ? 'border-2 border-ink-faint' : 'bg-ink/10'
                        )}
                        title={done ? 'Posted' : 'Not posted'}
                      />
                      <span className="sr-only">{done ? 'Posted' : 'Not posted'}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-ink-muted">
        Ticks are shared with the whole team. Full content planning (ideas, captions, views and likes) is coming in a later phase.
      </p>
    </div>
  )
}
