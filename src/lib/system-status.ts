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

/** Migrations the app expects, with what each one is for (shown when one is missing). */
export const EXPECTED_MIGRATIONS: { id: string; file: string; purpose: string }[] = [
  { id: '0008', file: '0008_member_admin_role.sql', purpose: 'Admin role' },
  { id: '0009', file: '0009_team_invitations.sql', purpose: 'Team roles and permissions' },
  { id: '0010', file: '0010_transfer_ownership.sql', purpose: 'Transfer ownership' },
  { id: '0011', file: '0011_receipts.sql', purpose: 'Receipts' },
  { id: '0012', file: '0012_customer_phone_key.sql', purpose: 'Phone-first customers' },
  { id: '0013', file: '0013_single_business.sql', purpose: 'Single business setup' },
  { id: '0014', file: '0014_member_display_names.sql', purpose: 'Team member names' },
  { id: '0015', file: '0015_order_completed_on.sql', purpose: 'Sales by completion day' },
  { id: '0016', file: '0016_push_notifications.sql', purpose: 'Phone notifications' },
  { id: '0017', file: '0017_product_ready_stock.sql', purpose: 'Ready stock' },
  { id: '0018', file: '0018_product_images.sql', purpose: 'Product photos' },
  { id: '0019', file: '0019_posting_reminder_preference.sql', purpose: 'Posting reminder' },
  { id: '0020', file: '0020_recipes.sql', purpose: 'Recipes' },
  { id: '0021', file: '0021_editable_sale_date.sql', purpose: 'Past sales and sale dates' },
  { id: '0022', file: '0022_system_status.sql', purpose: 'This status page' },
  { id: '0023', file: '0023_menu_catalogue.sql', purpose: 'Customer menu and catalogue' },
]

/** The ones not applied yet, oldest first. */
export function missingMigrations(applied: Record<string, boolean> | null | undefined) {
  return EXPECTED_MIGRATIONS.filter((m) => !applied?.[m.id])
}

/** "jdmyjdumxstirwzwinnu" from "https://jdmyjdumxstirwzwinnu.supabase.co". */
export function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname
    return host.endsWith('.supabase.co') ? host.split('.')[0] ?? null : null
  } catch {
    return null
  }
}
