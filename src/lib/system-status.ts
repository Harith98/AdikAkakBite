/**
 * Settings → System status: plan limits, health levels and the action names
 * the daily jobs log. Pure (no I/O) so the rules can be unit-tested.
 */

/** business_activity_logs actions the cron jobs write each run ("last ran"). */
export const CRON_ACTIONS = {
  orderReminders: 'cron_order_reminders',
  postingReminders: 'cron_posting_reminders',
} as const

/**
 * Free-plan limits as published by Supabase and Vercel when this was written
 * (late 2025). Plans change: the status page links to each dashboard's own
 * usage page, which is the source of truth.
 */
export const PLAN_LIMITS = {
  supabase: {
    databaseBytes: 500 * 1024 * 1024, // 500 MB
    storageBytes: 1024 * 1024 * 1024, // 1 GB
    monthlyActiveUsers: 50_000,
    egressPerMonth: '5 GB',
    egressBytes: 5 * 1024 * 1024 * 1024,
    pausesAfterInactiveDays: 7,
  },
  vercel: {
    fastDataTransferPerMonth: '100 GB',
    functionInvocationsPerMonth: '1,000,000',
    cronFrequency: 'once a day per job, within the hour',
  },
} as const

export type Level = 'ok' | 'warn' | 'critical'

/** Under 70% is fine, under 90% is worth watching, beyond that needs action. */
export function usageLevel(used: number, limit: number): Level {
  if (!(limit > 0)) return 'ok'
  const share = used / limit
  return share >= 0.9 ? 'critical' : share >= 0.7 ? 'warn' : 'ok'
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/**
 * A daily job should have run within the last day (plus slack for Vercel's
 * "within the hour" timing). Never run = warn, not critical: it may simply be
 * a fresh deployment.
 */
export function cronLevel(lastRunIso: string | null, now: Date = new Date()): Level {
  if (!lastRunIso) return 'warn'
  const hours = (now.getTime() - new Date(lastRunIso).getTime()) / 3_600_000
  return hours <= 26 ? 'ok' : hours <= 50 ? 'warn' : 'critical'
}

/**
 * The database version this code expects. supabase/schema.sql sets up this
 * version; each file in supabase/updates/ raises it by one (schema_version()).
 * Bump it together with the update file that needs it.
 */
export const SCHEMA_VERSION = 7

/** What Settings → System says about the database version (null = schema_version() isn't there yet). */
export function schemaCheck(version: number | null): { level: Level; detail: string } {
  if (version === null) {
    return { level: 'critical', detail: 'Not up to date: run the files in supabase/updates/ (oldest first) in the Supabase SQL Editor.' }
  }
  if (version < SCHEMA_VERSION) {
    return {
      level: 'critical',
      detail: `Version ${version}, but this app needs ${SCHEMA_VERSION}: run the newer files in supabase/updates/ (oldest first) in the Supabase SQL Editor.`,
    }
  }
  return { level: 'ok', detail: `Up to date (version ${version})` }
}

/** "abcdefghijklmnopqrst" from "https://abcdefghijklmnopqrst.supabase.co". */
export function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname
    return host.endsWith('.supabase.co') ? host.split('.')[0] ?? null : null
  } catch {
    return null
  }
}
