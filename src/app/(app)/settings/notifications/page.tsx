import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { pushConfigured } from '@/lib/notifications/push'
import type { NotificationKind } from '@/lib/notifications/messages'
import { Card } from '@/components/ui/Card'
import { NotificationSettings } from '@/components/settings/NotificationSettings'

export default async function NotificationsPage() {
  const { userId } = await getCurrentBusinessContext()
  const { data: saved } = await createClient()
    .from('notification_preferences')
    .select('low_stock, order_due, schedule_change')
    .eq('user_id', userId)
    .maybeSingle()

  // No saved row = everything on.
  const preferences: Record<NotificationKind, boolean> = {
    low_stock: saved?.low_stock ?? true,
    order_due: saved?.order_due ?? true,
    schedule_change: saved?.schedule_change ?? true,
  }
  const ready = pushConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <Link href="/settings" className="text-sm text-ink-muted">
          ← Settings
        </Link>
        <p className="mt-2 font-display text-3xl text-ink">Notifications</p>
        <p className="mt-1 text-sm text-ink-muted">Alerts on your phone’s lock screen, even when the app is closed.</p>
      </header>

      {ready ? (
        <NotificationSettings vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} preferences={preferences} />
      ) : (
        <Card className="!border-amber/60 !bg-amber-soft">
          <p className="text-sm font-medium text-amber-dark">Notifications aren’t set up on the server yet.</p>
          <p className="mt-1 text-sm text-amber-dark">
            The owner needs to add NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and SUPABASE_SERVICE_ROLE_KEY to
            the app’s environment variables and redeploy.
          </p>
        </Card>
      )}
    </div>
  )
}
