'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/app/(app)/settings/actions'
import { removeSubscription } from '@/app/(app)/settings/notifications/actions'

/** Turns this device's notifications off (best effort, never longer than ~3 s), so the next person on it starts fresh. */
async function stopThisDevicesNotifications() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const work = (async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await removeSubscription(sub.endpoint).catch(() => {})
    await sub.unsubscribe()
  })()
  await Promise.race([work.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))])
}

/**
 * Signs out. Also turns off notifications on this device: they arrive without
 * anyone signed in, so a phone handed to someone else would otherwise keep
 * showing the shop's notifications.
 */
export function SignOutButton({ label = 'Sign out', className }: { label?: string; className?: string }) {
  const [busy, setBusy] = useState(false)
  const cleaned = useRef(false)
  return (
    <form
      action={signOut}
      onSubmit={async (e) => {
        if (cleaned.current) return // second pass: let the sign-out go through
        e.preventDefault()
        const form = e.currentTarget
        setBusy(true)
        await stopThisDevicesNotifications()
        cleaned.current = true
        form.requestSubmit()
      }}
      className={className}
    >
      <Button type="submit" variant="secondary" loading={busy} className="w-full">
        {label}
      </Button>
    </form>
  )
}
