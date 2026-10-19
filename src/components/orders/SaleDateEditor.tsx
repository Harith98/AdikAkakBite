'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateShort } from '@/lib/time'
import { setSaleDate } from '@/app/(app)/orders/actions'
import { Button } from '@/components/ui/Button'

const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

/** Shows a completed order's sales day and lets it be corrected (e.g. marked complete a day late). */
export function SaleDateEditor({ orderId, completedOn, today }: { orderId: string; completedOn: string | null; today: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(completedOn ?? today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const result = await setSaleDate(orderId, date).catch(() => ({ error: 'Could not save. Check your connection.' }))
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="text-sm">
      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Sale date (counts in that day&apos;s and month&apos;s sales)
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={save} disabled={busy || !date}>
              {busy ? 'Saving…' : 'Save date'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">
            Sale date: <span className="font-medium text-ink">{completedOn ? formatDateShort(completedOn) : '—'}</span>
          </span>
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            Change
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-clay-dark">
          {error}
        </p>
      )}
    </div>
  )
}
