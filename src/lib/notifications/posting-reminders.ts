/**
 * The 8pm posting reminder, run once a day by Vercel Cron
 * (vercel.json → /api/cron/posting-reminders, 12:00 UTC).
 *
 * Looks at today's posting checklist (content_items posted today for the
 * checklist platforms) and, if anything is missing, tells the team which
 * platforms are left and how long a streak is at stake. Sends nothing once
 * every platform is ticked.
 */
import { createServiceRoleClient } from '@/lib/supabase/server'
import { CRON_ACTIONS } from '@/lib/system-status'
import { addDaysISO, getBusinessNow } from '@/lib/time'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { CHECKLIST_PLATFORMS, PLATFORM_LABELS, postingStreak } from '@/lib/content'
import type { ContentPlatform } from '@/lib/supabase/database.types'
import { postingReminderMessage } from './messages'
import { notifyTeam, pushConfigured } from './push'

/** How far back to look when counting a streak. A longer streak is reported as at least this. */
const STREAK_LOOKBACK_DAYS = 60

export interface PostingReminderResult {
  businesses: number
  reminded: number
  devicesReached: number
  skipped?: string
}

export async function runPostingReminders(): Promise<PostingReminderResult> {
  if (!pushConfigured()) return { businesses: 0, reminded: 0, devicesReached: 0, skipped: 'VAPID keys not set' }
  const admin = createServiceRoleClient()
  if (!admin) return { businesses: 0, reminded: 0, devicesReached: 0, skipped: 'SUPABASE_SERVICE_ROLE_KEY not set' }

  const { data: businesses, error } = await admin.from('business_settings').select('business_id, timezone')
  if (error) throw new Error(`Could not load businesses: ${error.message}`)

  const result: PostingReminderResult = { businesses: 0, reminded: 0, devicesReached: 0 }
  for (const business of businesses ?? []) {
    result.businesses++
    // "Last ran" for Settings → System status.
    await admin.from('business_activity_logs').insert({ business_id: business.business_id, action: CRON_ACTIONS.postingReminders, entity_type: 'system' })
    const today = getBusinessNow(business.timezone || DEFAULT_TIMEZONE).isoDate
    const days = Array.from({ length: STREAK_LOOKBACK_DAYS }, (_, i) => addDaysISO(today, -i)) // newest first

    const { data: rows, error: rowsError } = await admin
      .from('content_items')
      .select('platform, content_date')
      .eq('business_id', business.business_id)
      .eq('status', 'posted')
      .in('platform', [...CHECKLIST_PLATFORMS])
      .gte('content_date', days.at(-1) ?? today)
      .lte('content_date', today)
    if (rowsError) throw new Error(`Could not load posts: ${rowsError.message}`)

    const postedByDay = new Map<string, Set<ContentPlatform>>()
    for (const row of rows ?? []) {
      const set = postedByDay.get(row.content_date) ?? new Set<ContentPlatform>()
      set.add(row.platform)
      postedByDay.set(row.content_date, set)
    }

    const postedToday = postedByDay.get(today) ?? new Set<ContentPlatform>()
    const missing = CHECKLIST_PLATFORMS.filter((p) => !postedToday.has(p)).map((p) => PLATFORM_LABELS[p])
    // Today is incomplete whenever we send, so this counts complete days up to yesterday.
    const message = postingReminderMessage(missing, postingStreak(days, postedByDay))
    if (!message) continue

    result.reminded++
    result.devicesReached += await notifyTeam(business.business_id, 'posting_reminder', message)
  }
  return result
}
