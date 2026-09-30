'use server'

import { getActionContext } from '@/lib/services/action-context'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NOTIFICATION_KINDS, type NotificationKind } from '@/lib/notifications/messages'
import { notifyUser } from '@/lib/notifications/push'

export interface ActionResult {
  error: string | null
}

export interface DeviceSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const NO_ADMIN_KEY = 'Notifications aren’t set up on the server yet (missing SUPABASE_SERVICE_ROLE_KEY).'
const KINDS = NOTIFICATION_KINDS.map((k) => k.key)

function isValidSubscription(sub: DeviceSubscription): boolean {
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 2000) return false
  if (typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') return false
  if (sub.keys.p256dh.length > 200 || sub.keys.auth.length > 100) return false
  try {
    return new URL(sub.endpoint).protocol === 'https:'
  } catch {
    return false
  }
}

/** Remembers this device so the server can send it notifications. */
export async function saveSubscription(sub: DeviceSubscription, userAgent: string): Promise<ActionResult> {
  if (!isValidSubscription(sub)) return { error: 'This device returned an invalid subscription. Please try again.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const admin = createServiceRoleClient()
  if (!admin) return { error: NO_ADMIN_KEY }

  // Same endpoint = same browser install; if someone else used this phone before, it becomes yours.
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      business_id: ctx.businessId,
      user_id: ctx.userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent.slice(0, 300) || null,
    },
    { onConflict: 'endpoint' }
  )
  return { error: error ? error.message : null }
}

/** Stops notifications to this device. */
export async function removeSubscription(endpoint: string): Promise<ActionResult> {
  if (typeof endpoint !== 'string' || !endpoint) return { error: null }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const admin = createServiceRoleClient()
  if (!admin) return { error: NO_ADMIN_KEY }
  const { error } = await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', ctx.userId)
  return { error: error ? error.message : null }
}

/** Turns one kind of notification on or off for the signed-in person (all their devices). */
export async function saveNotificationPreference(kind: NotificationKind, enabled: boolean): Promise<ActionResult> {
  if (!KINDS.includes(kind) || typeof enabled !== 'boolean') return { error: 'Invalid setting.' }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const admin = createServiceRoleClient()
  if (!admin) return { error: NO_ADMIN_KEY }
  const change: Partial<Record<NotificationKind, boolean>> = { [kind]: enabled }
  const { error } = await admin
    .from('notification_preferences')
    .upsert({ user_id: ctx.userId, business_id: ctx.businessId, ...change }, { onConflict: 'user_id' })
  return { error: error ? error.message : null }
}

export async function sendTestNotification(): Promise<ActionResult> {
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const reached = await notifyUser(ctx.userId, {
    title: 'Notifications are working 🎉',
    body: 'You’ll get low stock, order and schedule alerts here.',
    url: '/settings/notifications',
    tag: 'test',
  })
  return { error: reached > 0 ? null : 'Nothing was delivered. Try turning notifications off and on again on this device.' }
}
