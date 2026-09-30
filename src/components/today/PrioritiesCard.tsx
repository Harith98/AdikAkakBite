'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import clsx from '@/lib/clsx'
import { savePriority, setTaskStatus } from '@/app/(app)/today/actions'
import type { TaskStatus } from '@/lib/supabase/database.types'
import type { PrioritySuggestion } from '@/lib/services/priorities'

export interface PriorityTask {
  id: string
  title: string
  status: TaskStatus
  rank: number
}

interface PrioritiesCardProps {
  priorities: PriorityTask[]
  suggestions: PrioritySuggestion[]
}

export function PrioritiesCard({ priorities, suggestions }: PrioritiesCardProps) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const byRank = new Map(priorities.map((p) => [p.rank, p]))
  const firstEmpty = [1, 2, 3].find((rank) => !byRank.has(rank))

  async function guard(action: () => Promise<{ error: string | null }>) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. This change can't be saved until your connection returns.")
      return
    }
    setError(null)
    setBusy(true)
    try {
      const result = await action()
      if (result.error) setError(result.error)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleSave(rank: number, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = String(new FormData(event.currentTarget).get('title') ?? '')
    void guard(() => savePriority(rank, title))
  }

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Today&apos;s priorities</p>
      <ol className="mt-3 flex flex-col gap-2">
        {[1, 2, 3].map((rank) => {
          const task = byRank.get(rank)
          const done = task?.status === 'completed'
          return (
            <li key={`${rank}-${task?.id ?? 'empty'}-${task?.title ?? ''}`}>
              <form onSubmit={(e) => handleSave(rank, e)} className="flex items-center gap-1.5">
                {/* 44px tap target around a 36px circle: stays round and easy to hit on phones. */}
                <button
                  type="button"
                  disabled={!task || busy}
                  aria-label={task ? (done ? 'Mark priority as not done' : 'Mark priority as done') : `Priority ${rank}`}
                  onClick={() => task && guard(() => setTaskStatus(task.id, done ? 'not_started' : 'completed'))}
                  className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill"
                >
                  <span
                    className={clsx(
                      'flex h-9 w-9 items-center justify-center rounded-pill border-2 text-sm font-medium transition-colors',
                      done ? 'border-sage-dark bg-sage-dark text-white' : 'border-ink-faint text-ink-muted'
                    )}
                  >
                    {done ? '✓' : rank}
                  </span>
                </button>
                <input
                  name="title"
                  defaultValue={task?.title ?? ''}
                  maxLength={120}
                  placeholder={`Priority ${rank}`}
                  aria-label={`Priority ${rank}`}
                  className={clsx(
                    'h-11 min-w-0 flex-1 rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry',
                    done && 'text-ink-faint line-through'
                  )}
                />
                <Button type="submit" variant="ghost" size="md" disabled={busy}>
                  Save
                </Button>
              </form>
            </li>
          )
        })}
      </ol>

      {firstEmpty !== undefined && suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-ink-muted">Suggested for today</p>
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <button
                key={s.title}
                type="button"
                disabled={busy}
                onClick={() => guard(() => savePriority(firstEmpty, s.title))}
                className="rounded-card border border-dashed border-ink/20 px-3 py-2 text-left text-sm text-ink hover:border-raspberry"
              >
                + {s.title}
                <span className="block text-xs text-ink-muted">{s.reason}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-clay-dark">
          {error}
        </p>
      )}
    </Card>
  )
}
