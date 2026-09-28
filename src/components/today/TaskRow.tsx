'use client'

import { useState } from 'react'
import clsx from '@/lib/clsx'
import { setTaskStatus } from '@/app/(app)/today/actions'
import type { TaskStatus } from '@/lib/supabase/database.types'

interface TaskRowProps {
  id: string
  title: string
  status: TaskStatus
  isPriority?: boolean
}

/** One task in a list. Tap the circle to tick it off (or undo). */
export function TaskRow({ id, title, status, isPriority }: TaskRowProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const done = status === 'completed'

  async function toggle() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. Reconnect to save changes.")
      return
    }
    setError(null)
    setPending(true)
    try {
      const result = await setTaskStatus(id, done ? 'not_started' : 'completed')
      if (result.error) setError(result.error)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <li className="flex flex-col">
      <div className="flex min-h-11 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={done ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
          className={clsx(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border-2 transition-colors',
            done ? 'border-sage-dark bg-sage-dark text-white' : 'border-ink-faint text-transparent hover:border-raspberry'
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <span className={clsx('flex-1 text-sm', done || status === 'skipped' ? 'text-ink-faint line-through' : 'text-ink')}>
          {title}
        </span>
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
