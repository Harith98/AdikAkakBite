'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { NOTIFICATION_KINDS, type NotificationKind } from '@/lib/notifications/messages'
import {
  removeSubscription,
  saveNotificationPreference,
  saveSubscription,
  sendTestNotification,
  type DeviceSubscription,
} from '@/app/(app)/settings/notifications/actions'

type DeviceState =
  | 'checking'
  | 'unsupported' // browser has no web push
  | 'ios-install' // iPhone/iPad Safari: only works from the Home Screen app
  | 'blocked' // permission denied in browser/phone settings
  | 'off'
  | 'on'

interface Props {
  vapidPublicKey: string
  preferences: Record<NotificationKind, boolean>
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // Normally registered on load in production; registering again is a no-op.
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export function NotificationSettings({ vapidPublicKey, preferences }: Props) {
  const [device, setDevice] = useState<DeviceState>('checking')
  const [prefs, setPrefs] = useState(preferences)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported) {
      setDevice(isIos() && !isStandalone() ? 'ios-install' : 'unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setDevice('blocked')
      return
    }
    getRegistration()
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setDevice(sub && Notification.permission === 'granted' ? 'on' : 'off'))
      .catch(() => setDevice('off'))
  }, [])

  async function turnOn() {
    setBusy(true)
    setMessage(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setDevice(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const reg = await getRegistration()
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        }))
      const result = await saveSubscription(sub.toJSON() as DeviceSubscription, navigator.userAgent)
      if (result.error) {
        setMessage({ ok: false, text: result.error })
        return
      }
      setDevice('on')
      setMessage({ ok: true, text: 'Notifications are on for this device.' })
    } catch {
      setMessage({ ok: false, text: 'Couldn’t turn on notifications. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    setMessage(null)
    try {
      const sub = await (await getRegistration()).pushManager.getSubscription()
      if (sub) {
        await removeSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setDevice('off')
    } catch {
      setMessage({ ok: false, text: 'Couldn’t turn off notifications. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setMessage(null)
    const result = await sendTestNotification().catch(() => ({ error: 'Something went wrong. Please try again.' }))
    setMessage(result.error ? { ok: false, text: result.error } : { ok: true, text: 'Sent! It should appear in a moment.' })
    setBusy(false)
  }

  async function toggle(kind: NotificationKind, enabled: boolean) {
    setPrefs((p) => ({ ...p, [kind]: enabled }))
    const result = await saveNotificationPreference(kind, enabled).catch(() => ({ error: 'Could not save.' }))
    if (result.error) {
      setPrefs((p) => ({ ...p, [kind]: !enabled }))
      setMessage({ ok: false, text: result.error })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">This device</p>
        {device === 'checking' && <p className="mt-2 text-sm text-ink-muted">Checking…</p>}

        {device === 'ios-install' && (
          <div className="mt-2 flex flex-col gap-2 text-sm text-ink-muted">
            <p className="font-medium text-ink">On iPhone, add the app to your Home Screen first.</p>
            <ol className="list-decimal pl-5">
              <li>In Safari, tap the Share button (square with an arrow).</li>
              <li>Choose <span className="font-medium text-ink">Add to Home Screen</span>.</li>
              <li>Open the app from the new Home Screen icon and come back to this page.</li>
            </ol>
            <p className="text-xs">Needs iOS 16.4 or newer.</p>
          </div>
        )}

        {device === 'unsupported' && (
          <p className="mt-2 text-sm text-ink-muted">
            This browser can’t receive notifications. On Android use Chrome; on iPhone open the app from your Home Screen.
          </p>
        )}

        {device === 'blocked' && (
          <p className="mt-2 text-sm text-ink-muted">
            Notifications are blocked for this app. Allow them in your phone or browser settings (Site settings →
            Notifications), then reload this page.
          </p>
        )}

        {(device === 'off' || device === 'on') && (
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-sm text-ink">
              {device === 'on' ? '🔔 Notifications are on for this device.' : 'Notifications are off for this device.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {device === 'off' ? (
                <Button type="button" onClick={turnOn} disabled={busy}>
                  {busy ? 'Turning on…' : 'Turn on notifications'}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={test} disabled={busy}>
                    Send a test
                  </Button>
                  <Button type="button" variant="ghost" onClick={turnOff} disabled={busy}>
                    Turn off
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'mt-3 text-sm text-sage-dark' : 'mt-3 text-sm text-clay-dark'}>
            {message.text}
          </p>
        )}
      </Card>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">What to notify you about</p>
        <p className="mt-1 text-sm text-ink-muted">Applies to all your devices.</p>
        <ul className="mt-3 flex flex-col divide-y divide-ink/5">
          {NOTIFICATION_KINDS.map((kind) => (
            <li key={kind.key}>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-ink">{kind.label}</span>
                  <span className="block text-sm text-ink-muted">{kind.text}</span>
                </span>
                <input
                  type="checkbox"
                  checked={prefs[kind.key]}
                  onChange={(e) => toggle(kind.key, e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-raspberry"
                />
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
