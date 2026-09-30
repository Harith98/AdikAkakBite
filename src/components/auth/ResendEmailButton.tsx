'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

/** Supabase refuses a repeat auth email to the same address for about a minute. */
export const RESEND_COOLDOWN_SECONDS = 60

/** Turn Supabase's rate-limit errors into something a person can act on. */
export function friendlyEmailError(message: string): string {
  // Sign-in links don't create accounts (owners/admins create accounts).
  if (/signups not allowed/i.test(message)) {
    return 'No account uses this email yet. Ask the owner or an admin to create one for you.'
  }
  if (/email rate limit exceeded/i.test(message)) {
    return 'Too many emails have been sent from the app this hour. Please try again later.'
  }
  const wait = message.match(/after (\d+) seconds?/i)
  if (wait) return `Please wait ${wait[1]} seconds before asking for another email.`
  return message
}

/**
 * "Didn't get the email? Resend" with a countdown, so people can't hammer
 * Supabase's per-address limit and get a confusing error instead.
 * `onResend` returns Supabase's error message, or null on success.
 */
export function ResendEmailButton({
  label,
  onResend,
  startWithCooldown = true,
}: {
  label: string
  onResend: () => Promise<string | null>
  /** True when an email was *just* sent, so the first resend has to wait too. */
  startWithCooldown?: boolean
}) {
  const [secondsLeft, setSecondsLeft] = useState(startWithCooldown ? RESEND_COOLDOWN_SECONDS : 0)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft])

  async function resend() {
    setPending(true)
    setStatus(null)
    const error = await onResend()
    setPending(false)
    if (error) {
      setStatus({ ok: false, text: friendlyEmailError(error) })
      const wait = error.match(/after (\d+) seconds?/i)
      if (wait) setSecondsLeft(Number(wait[1]))
      return
    }
    setStatus({ ok: true, text: 'Sent again. Check your inbox and spam folder.' })
    setSecondsLeft(RESEND_COOLDOWN_SECONDS)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" className="w-full" disabled={pending || secondsLeft > 0} onClick={resend}>
        {pending ? 'Sending…' : secondsLeft > 0 ? `${label} in ${secondsLeft}s` : label}
      </Button>
      {status && (
        <p role={status.ok ? 'status' : 'alert'} className={status.ok ? 'text-sm text-sage-dark' : 'text-sm text-clay-dark'}>
          {status.text}
        </p>
      )}
    </div>
  )
}
