import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import {
  CRON_ACTIONS,
  cronLevel,
  formatBytes,
  missingMigrations,
  PLAN_LIMITS,
  supabaseProjectRef,
  usageLevel,
  type Level,
} from '@/lib/system-status'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'System status' }

interface SystemStatus {
  database_bytes: number
  storage_bytes: number
  storage_files: number
  auth_users: number
  rows: Record<string, number>
  migrations: Record<string, boolean>
}

const LEVEL_STYLE: Record<Level, { icon: string; text: string; bar: string }> = {
  ok: { icon: '✓', text: 'text-sage-dark', bar: 'bg-sage-dark' },
  warn: { icon: '!', text: 'text-amber-dark', bar: 'bg-amber' },
  critical: { icon: '✕', text: 'text-clay-dark', bar: 'bg-clay' },
}

export default async function SystemStatusPage() {
  const { business, role, settings } = await getCurrentBusinessContext()
  if (role !== 'owner') redirect('/settings')
  const supabase = createClient()

  const [statusRes, cronRes, devicesRes] = await Promise.all([
    supabase.rpc('app_system_status'),
    supabase
      .from('business_activity_logs')
      .select('action, created_at')
      .eq('business_id', business.id)
      .in('action', Object.values(CRON_ACTIONS))
      .order('created_at', { ascending: false })
      .limit(20),
    createServiceRoleClient()?.from('push_subscriptions').select('id', { count: 'exact', head: true }) ?? Promise.resolve(null),
  ])
  const status = statusRes.error ? null : (statusRes.data as unknown as SystemStatus)
  const lastRun = (action: string) => (cronRes.data ?? []).find((r) => r.action === action)?.created_at ?? null
  const devices = devicesRes && !devicesRes.error ? devicesRes.count ?? 0 : null

  // ---- Health checks: everything here is yes/no; secret values are never shown ----
  const missing = status ? missingMigrations(status.migrations) : []
  const checks: { label: string; level: Level; detail: string }[] = [
    {
      label: 'Database migrations',
      level: !status ? 'critical' : missing.length === 0 ? 'ok' : 'critical',
      detail: !status
        ? 'Run 0022_system_status.sql in the Supabase SQL Editor to see the full status.'
        : missing.length === 0
          ? 'All applied'
          : `Not applied: ${missing.map((m) => `${m.id} (${m.purpose})`).join(', ')}. Run them in order in the Supabase SQL Editor.`,
    },
    {
      label: 'Admin key (SUPABASE_SERVICE_ROLE_KEY)',
      level: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'ok' : 'critical',
      detail: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing: adding staff, password resets and notifications won’t work.',
    },
    {
      label: 'Notification keys (VAPID)',
      level: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? 'ok' : 'warn',
      detail:
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
          ? `Set${devices !== null ? ` · ${devices} device${devices === 1 ? '' : 's'} subscribed` : ''}`
          : 'Missing: phone notifications are off.',
    },
    {
      label: 'Daily job password (CRON_SECRET)',
      level: process.env.CRON_SECRET ? 'ok' : 'warn',
      detail: process.env.CRON_SECRET ? 'Set' : 'Missing: the daily order and posting reminders can’t run.',
    },
  ]
  const problems = checks.filter((c) => c.level !== 'ok').length

  const projectRef = supabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseDashboard = projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : 'https://supabase.com/dashboard'
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  const timeFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <Link href="/settings" className="text-sm text-ink-muted">
          ← Settings
        </Link>
        <p className="mt-2 font-display text-3xl text-ink">System status</p>
        <p className="mt-1 text-sm text-ink-muted">Usage against the free plans, and anything that needs fixing. Only you (the owner) can see this.</p>
      </header>

      <Card className={problems === 0 ? '!border-sage/40 !bg-sage-soft/40' : '!border-clay/40 !bg-clay-soft/40'}>
        <p className={clsx('font-medium', problems === 0 ? 'text-sage-dark' : 'text-clay-dark')}>
          {problems === 0 ? '✓ Everything is set up correctly' : `${problems} thing${problems === 1 ? ' needs' : 's need'} attention`}
        </p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {checks.map((check) => (
            <li key={check.label} className="flex gap-3 text-sm">
              <StatusDot level={check.level} />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{check.label}</span>
                <span className="block text-ink-muted">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Supabase · free plan</p>
          <a href={`${supabaseDashboard}/usage`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-raspberry-dark">
            Usage ↗
          </a>
        </div>
        {status ? (
          <div className="mt-3 flex flex-col gap-4">
            <UsageBar label="Database" used={status.database_bytes} limit={PLAN_LIMITS.supabase.databaseBytes} format={formatBytes} />
            <UsageBar
              label={`Product photos (${status.storage_files} file${status.storage_files === 1 ? '' : 's'})`}
              used={status.storage_bytes}
              limit={PLAN_LIMITS.supabase.storageBytes}
              format={formatBytes}
            />
            <UsageBar
              label="Logins (owner + team)"
              used={status.auth_users}
              limit={PLAN_LIMITS.supabase.monthlyActiveUsers}
              format={(n) => n.toLocaleString('en-GB')}
            />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {Object.entries(status.rows).map(([table, count]) => (
                <div key={table} className="flex justify-between gap-2">
                  <dt className="text-ink-muted">{table.replace(/_/g, ' ')}</dt>
                  <dd className="tabular-nums text-ink">{count.toLocaleString('en-GB')}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-ink-muted">
              Not measurable from here: data transfer ({PLAN_LIMITS.supabase.egressPerMonth}/month on the free plan). Free projects
              pause after {PLAN_LIMITS.supabase.pausesAfterInactiveDays} days without use; the daily reminders keep yours active.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">Run migration 0022 to see database and storage usage here.</p>
        )}
      </Card>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Daily jobs (Vercel Cron)</p>
        <ul className="mt-3 flex flex-col gap-2.5 text-sm">
          {[
            { label: 'Order reminders', when: '8am', action: CRON_ACTIONS.orderReminders },
            { label: 'Posting reminders', when: '8pm', action: CRON_ACTIONS.postingReminders },
          ].map((job) => {
            const last = lastRun(job.action)
            return (
              <li key={job.action} className="flex gap-3">
                <StatusDot level={cronLevel(last)} />
                <span>
                  <span className="block font-medium text-ink">
                    {job.label} <span className="font-normal text-ink-muted">· daily around {job.when}</span>
                  </span>
                  <span className="block text-ink-muted">{last ? `Last ran ${timeFormat.format(new Date(last))}` : 'Hasn’t run yet since this page was added'}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Vercel · Hobby plan</p>
          <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-raspberry-dark">
            Dashboard ↗
          </a>
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          <Row label="This deployment" value={process.env.VERCEL_ENV ? `${process.env.VERCEL_ENV}${commit ? ` · ${commit}` : ''}` : 'Local (not on Vercel)'} />
          <Row label="Server region" value={process.env.VERCEL_REGION ?? '—'} />
          <Row label="Data transfer" value={`${PLAN_LIMITS.vercel.fastDataTransferPerMonth} / month`} />
          <Row label="Function calls" value={`${PLAN_LIMITS.vercel.functionInvocationsPerMonth} / month`} />
          <Row label="Cron jobs" value={PLAN_LIMITS.vercel.cronFrequency} />
        </dl>
        <p className="mt-3 text-xs text-ink-muted">
          Vercel doesn&apos;t let the app read its own usage. Check it under Dashboard → your project → Usage. A small business
          uses a tiny fraction of these limits.
        </p>
      </Card>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">If something breaks</p>
        <div className="mt-2 flex flex-col divide-y divide-ink/5 text-sm">
          {TROUBLESHOOTING.map((item) => (
            <details key={item.problem} className="group py-2.5">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-medium text-ink">
                {item.problem}
                <span aria-hidden="true" className="text-ink-faint transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <p className="mt-1 text-ink-muted">{item.fix}</p>
            </details>
          ))}
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        Limits shown are the published free-plan limits at the time this was built; plans change, so the dashboards are the
        source of truth.
      </p>
    </div>
  )
}

const TROUBLESHOOTING = [
  {
    problem: 'The app won’t load or nobody can sign in',
    fix: 'Open the Supabase dashboard. If the project says “Paused”, press Restore (free projects pause after a week unused). Otherwise check Vercel → Deployments: if the latest one failed, use “Redeploy” on the last working one.',
  },
  {
    problem: 'A page shows an error after an update',
    fix: 'Usually a database migration wasn’t run. The checks at the top of this page list any that are missing; run them in order in the Supabase SQL Editor.',
  },
  {
    problem: 'Phone notifications stopped arriving',
    fix: 'On the phone: Settings → Notifications → Send a test. If nothing arrives, turn notifications off and on again. If the keys above show as missing, add them in Vercel and redeploy. Never change the VAPID keys once set.',
  },
  {
    problem: 'Reminders didn’t come at 8am / 8pm',
    fix: 'Check “Daily jobs” above. If they haven’t run for over a day, make sure CRON_SECRET is set in Vercel and the latest deployment succeeded.',
  },
  {
    problem: 'Database or storage is getting full',
    fix: 'Over 70% shows in amber here. Delete unused product photos, or upgrade the Supabase plan. At this business’s size this is years away.',
  },
  {
    problem: 'Staff can’t be added or reset',
    fix: 'The admin key (SUPABASE_SERVICE_ROLE_KEY) must be set in Vercel. After adding or changing any key, redeploy.',
  },
]

function StatusDot({ level }: { level: Level }) {
  return (
    <span
      aria-label={level === 'ok' ? 'OK' : level === 'warn' ? 'Warning' : 'Problem'}
      className={clsx(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-[11px] font-bold text-white',
        level === 'ok' ? 'bg-sage-dark' : level === 'warn' ? 'bg-amber-dark' : 'bg-clay'
      )}
    >
      {LEVEL_STYLE[level].icon}
    </span>
  )
}

function UsageBar({ label, used, limit, format }: { label: string; used: number; limit: number; format: (n: number) => string }) {
  const level = usageLevel(used, limit)
  const percent = Math.min(100, (used / limit) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink">{label}</span>
        <span className={clsx('tabular-nums', LEVEL_STYLE[level].text)}>
          {format(used)} <span className="text-ink-faint">of {format(limit)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-ink/10" role="meter" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={clsx('h-full rounded-pill', LEVEL_STYLE[level].bar)} style={{ width: `${Math.max(percent, used > 0 ? 1 : 0)}%` }} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  )
}
