'use client'

import { useEffect, useState } from 'react'
import clsx from '@/lib/clsx'
import { setTaskStatus } from '@/app/(app)/today/actions'
import { tapFeedback } from '@/lib/haptics'
import type { TaskStatus } from '@/lib/supabase/database.types'

interface TaskRowProps {
  id: string
  title: string
  status: TaskStatus
  isPriority?: boolean
  /** A small label after the title, e.g. "Next" or "Overdue". */
  tag?: string
}

/** One task in a list. Tap the circle to tick it off (or undo). */
export function TaskRow({ id, title, status, isPriority, tag }: TaskRowProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The tick shows the moment it's tapped (and pops), before the server confirms.
  const [override, setOverride] = useState<boolean | null>(null)
  const [popKey, setPopKey] = useState(0)
  const done = override ?? status === 'completed'

  // Once the page refreshes with the saved status, follow it again.
  useEffect(() => setOverride(null), [status])

  async function toggle() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. Reconnect to save changes.")
      return
    }
    const next = !done
    setError(null)
    setOverride(next)
    if (next) {
      setPopKey((k) => k + 1)
      tapFeedback()
    }
    setPending(true)
    try {
      const result = await setTaskStatus(id, next ? 'completed' : 'not_started')
      if (result.error) {
        setOverride(null)
        setError(result.error)
      }
    } catch {
      setOverride(null)
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <li className="flex flex-col">
      <div className="flex min-h-11 items-center gap-1">
        {/* 44px square tap target around a 28px circle, so it stays round and easy to hit on phones. */}
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={done ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
          className="group -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill disabled:opacity-60"
        >
          <span
            key={popKey}
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-pill border-2 transition-colors',
              done ? 'border-sage-dark bg-sage-dark text-white' : 'border-ink-faint text-transparent group-hover:border-raspberry',
              popKey > 0 && done && 'tick-pop'
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </button>
        <span className={clsx('min-w-0 flex-1 break-words text-sm', done || status === 'skipped' ? 'text-ink-faint line-through' : 'text-ink')}>
          {title}
        </span>
        {tag && status !== 'completed' && status !== 'skipped' && (
          <span
            className={clsx(
              'shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium',
              tag === 'Overdue' ? 'bg-clay-soft text-clay-dark' : 'bg-raspberry-soft text-raspberry-dark'
            )}
          >
            {tag}
          </span>
        )}
        {status === 'in_progress' && <span className="text-xs font-medium text-raspberry-dark">In progress</span>}
        {status === 'paused' && <span className="text-xs font-medium text-amber-dark">Paused</span>}
        {status === 'skipped' && <span className="text-xs text-ink-faint">Skipped</span>}
        {isPriority && status !== 'completed' && <span className="text-xs text-ink-faint">★</span>}
      </div>
      {error && (
        <p role="alert" className="pb-1 pl-10 text-xs text-clay-dark">
          {error}
        </p>
      )}
    </li>
  )
}
