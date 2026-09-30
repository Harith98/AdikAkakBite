/**
 * Sends web-push notifications. Server-only: it uses the service-role client
 * (to read everyone's devices) and the private VAPID key.
 *
 * Never throws. A notification is a courtesy, so a push-service hiccup or a
 * missing key must not fail the save that triggered it.
 */
import webpush from 'web-push'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PRODUCTION_SITE_URL } from '@/lib/site-url'
import type { NotificationKind, PushMessage } from './messages'

interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

let vapidReady: boolean | null = null

/** True when the VAPID keys are set, i.e. notifications can be sent at all. */
export function pushConfigured(): boolean {
  if (vapidReady !== null) return vapidReady
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return (vapidReady = false)
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || PRODUCTION_SITE_URL, publicKey, privateKey)
    return (vapidReady = true)
  } catch (err) {
    console.error('Invalid VAPID keys:', err)
    return (vapidReady = false)
  }
}

/**
 * Sends to every device of every current team member who has `kind` turned
 * on (no saved preferences = everything on). Returns how many devices it reached.
 */
export async function notifyTeam(
  businessId: string,
  kind: NotificationKind,
  messages: PushMessage | PushMessage[],
  options: { excludeUserId?: string } = {}
): Promise<number> {
  const list = Array.isArray(messages) ? messages : [messages]
  if (list.length === 0 || !pushConfigured()) return 0
  const admin = createServiceRoleClient()
  if (!admin) return 0

  try {
    const [subsRes, prefsRes, membersRes] = await Promise.all([
      admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('business_id', businessId),
      admin.from('notification_preferences').select(`user_id, ${kind}`).eq('business_id', businessId),
      admin.from('business_members').select('user_id').eq('business_id', businessId),
    ])
    if (subsRes.error || prefsRes.error || membersRes.error) {
      console.error('Could not load notification recipients:', subsRes.error ?? prefsRes.error ?? membersRes.error)
      return 0
    }

    const members = new Set((membersRes.data ?? []).map((m) => m.user_id))
    const optedOut = new Set(
      ((prefsRes.data ?? []) as unknown as Record<string, unknown>[])
        .filter((p) => p[kind] === false)
        .map((p) => p.user_id as string)
    )
    const targets = (subsRes.data ?? []).filter(
      (s) => members.has(s.user_id) && !optedOut.has(s.user_id) && s.user_id !== options.excludeUserId
    )
    return await sendAll(targets, list)
  } catch (err) {
    console.error('Sending notifications failed:', err)
    return 0
  }
}

/** Sends to one person's own devices (the "Send a test" button). */
export async function notifyUser(userId: string, message: PushMessage): Promise<number> {
  if (!pushConfigured()) return 0
  const admin = createServiceRoleClient()
  if (!admin) return 0
  try {
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .eq('user_id', userId)
    if (error) throw error
    return await sendAll(data ?? [], [message])
  } catch (err) {
    console.error('Sending a test notification failed:', err)
    return 0
  }
}

async function sendAll(subscriptions: Subscription[], messages: PushMessage[]): Promise<number> {
  const expired = new Set<string>()
  let delivered = 0

  await Promise.all(
    subscriptions.map(async (sub) => {
      for (const message of messages) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(message),
            { TTL: 60 * 60 * 24 } // still worth showing if the phone is offline for up to a day
          )
          delivered++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          // 404/410: the browser dropped this subscription (app removed, permission revoked).
          if (status === 404 || status === 410) {
            expired.add(sub.id)
            return
          }
          console.error('Push delivery failed:', status ?? err)
        }
      }
    })
  )

  if (expired.size > 0) {
    await createServiceRoleClient()?.from('push_subscriptions').delete().in('id', Array.from(expired))
  }
  return delivered
}
