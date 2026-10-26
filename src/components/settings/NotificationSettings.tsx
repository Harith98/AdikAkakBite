'use client'

import { SectionLabel } from '@/components/ui/SectionLabel'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { NOTIFICATION_KINDS, type NotificationKind } from '@/lib/notifications/messages'
import {
  getDeviceStatus,
  removeSubscription,
  saveDeviceName,
  saveNotificationPreference,
  saveSubscription,
  sendTestNotification,
  type DeviceSubscription,
} from '@/app/(app)/settings/notifications/actions'
import { describeDevice } from '@/lib/device-label'

const nameInput = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

/** A starting suggestion, e.g. "My iPhone" (websites can't read the exact model). */
const suggestedName = () => `My ${describeDevice(navigator.userAgent).split(' · ')[0]}`

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
  // This device's name: asked for when turning on, and for devices already on without one.
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [naming, setNaming] = useState(false)
  const [namesSupported, setNamesSupported] = useState(true)
  // On in this browser, but for another account that used this phone.
  const [otherAccount, setOtherAccount] = useState(false)

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
    setNameDraft(suggestedName())
    getRegistration()
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub || Notification.permission !== 'granted') {
          setDevice('off')
          return
        }
        // The browser has notifications on, but are they yours?
        const status = await getDeviceStatus(sub.endpoint).catch(() => ({ owner: 'none' as const, name: null, namesSupported: false }))
        setNamesSupported(status.namesSupported)
        if (status.owner !== 'me') {
          // Another account's (or not saved): "Turn on" makes them yours.
          setOtherAccount(status.owner === 'other')
          setDevice('off')
          return
        }
        setEndpoint(sub.endpoint)
        setDeviceName(status.name)
        setDevice('on')
        // Already on but never named: ask now.
        if (status.namesSupported && !status.name) setNaming(true)
      })
      .catch(() => setDevice('off'))
  }, [])

  async function turnOn() {
    const name = nameDraft.trim()
    if (!name) {
      setMessage({ ok: false, text: 'Give this device a name first, e.g. "My iPhone".' })
      return
    }
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
      const result = await saveSubscription(sub.toJSON() as DeviceSubscription, navigator.userAgent, name)
      if (result.error) {
        setMessage({ ok: false, text: result.error })
        return
      }
      setDevice('on')
      setOtherAccount(false)
      setEndpoint(sub.endpoint)
      setDeviceName(name)
      setNaming(false)
      setMessage({ ok: true, text: `Notifications are on for ${name}.` })
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
      setDeviceName(null)
      setNaming(false)
      setNameDraft(suggestedName())
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

  async function saveName() {
    const name = nameDraft.trim()
    if (!name || !endpoint) return
    setBusy(true)
    setMessage(null)
    const result = await saveDeviceName(endpoint, name).catch(() => ({ error: 'Could not save. Check your connection.' }))
    setBusy(false)
    if (result.error) {
      setMessage({ ok: false, text: result.error })
      return
    }
    setDeviceName(name)
    setNaming(false)
    setMessage({ ok: true, text: `Saved. This device is now “${name}”.` })
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
        <SectionLabel icon="📱">This device</SectionLabel>
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
              {device === 'on' ? (
                <>
                  🔔 Notifications are on for <span className="font-medium">{deviceName ?? 'this device'}</span>.
                  {namesSupported && deviceName && !naming && (
                    <button
                      type="button"
                      onClick={() => {
                        setNameDraft(deviceName)
                        setNaming(true)
                      }}
                      className="ml-2 rounded-pill px-2 py-0.5 text-xs font-medium text-raspberry-dark hover:bg-raspberry-soft"
                    >
                      Rename
                    </button>
                  )}
                </>
              ) : otherAccount ? (
                <span className="block rounded-card bg-amber-soft px-3 py-2 text-amber-dark">
                  This phone gets notifications for another account that used it. Turn them on below to get yours here instead.
                </span>
              ) : (
                'Notifications are off for this device.'
              )}
            </p>

            {/* Name: before turning on, or for a device that's on without one (or being renamed). */}
            {(device === 'off' || (device === 'on' && naming)) && (
              <div className={device === 'on' && !deviceName ? 'rounded-card bg-amber-soft p-3' : ''}>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-ink">{device === 'on' && !deviceName ? 'Name this device' : 'Device name'}</span>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={40}
                    placeholder="e.g. Harith’s iPhone, Kitchen iPad"
                    className={nameInput}
                  />
                  <span className="text-xs text-ink-muted">So you can tell your devices apart in System status. Phones don’t share their model.</span>
                </label>
                {device === 'on' && (
                  <div className="mt-2 flex gap-2">
                    <Button type="button" onClick={saveName} loading={busy} disabled={!nameDraft.trim()}>
                      Save name
                    </Button>
                    {deviceName && (
                      <Button type="button" variant="ghost" onClick={() => setNaming(false)} disabled={busy}>
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {device === 'off' ? (
                <Button type="button" onClick={turnOn} loading={busy} disabled={!nameDraft.trim()}>
                  {busy ? 'Turning on…' : otherAccount ? 'Turn on for me' : 'Turn on notifications'}
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
        <SectionLabel icon="🔔">What to notify you about</SectionLabel>
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
