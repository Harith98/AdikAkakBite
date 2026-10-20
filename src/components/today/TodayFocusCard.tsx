'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import clsx from '@/lib/clsx'
import { TASK_CATEGORY_OPTIONS } from '@/lib/constants'
import { addTask, savePriority, setTaskStatus, type AddTaskState } from '@/app/(app)/today/actions'
import type { TaskStatus } from '@/lib/supabase/database.types'
import type { PrioritySuggestion } from '@/lib/services/priorities'
import { Card } from '@/components/ui/Card'
import { tapFeedback } from '@/lib/haptics'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'

export interface PriorityTask {
  id: string
  title: string
  status: TaskStatus
  rank: number
}

const MAX_PRIORITIES = 3
const initialState: AddTaskState = { error: null, nonce: 0 }

/**
 * Today's priorities and adding tasks, in one card. Priorities are real tasks
 * you tick off; the box underneath adds any task, starred to make it a priority.
 */
export function TodayFocusCard({ priorities, suggestions }: { priorities: PriorityTask[]; suggestions: PrioritySuggestion[] }) {
  const [state, formAction] = useFormState(addTask, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const [starred, setStarred] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The priority just ticked, so only it plays the pop. */
  const [justDone, setJustDone] = useState<string | null>(null)

  const sorted = [...priorities].sort((a, b) => a.rank - b.rank)
  const slotsLeft = MAX_PRIORITIES - sorted.length
  const firstFree = [1, 2, 3].find((r) => !sorted.some((p) => p.rank === r))
  const done = sorted.filter((p) => p.status === 'completed').length

  useEffect(() => {
    if (state.nonce !== 0) {
      formRef.current?.reset()
      setStarred(false)
    }
  }, [state.nonce])
  useEffect(() => {
    if (slotsLeft === 0) setStarred(false)
  }, [slotsLeft])

  async function run(action: () => Promise<{ error: string | null }>) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. This can't be saved until your connection returns.")
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

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel icon="🎯">Today&apos;s priorities</SectionLabel>
        {sorted.length > 0 && (
          <p className={clsx('text-sm', done === sorted.length ? 'celebrate-in font-medium text-sage-dark' : 'text-ink-muted')}>
            {done === sorted.length ? 'All done 🎉' : `${done} of ${sorted.length} done`}
          </p>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState compact emoji="🎯" title="What matters most today?" text="Pick up to three. Star a task below, or tap a suggestion." />
      ) : (
        <ol className="mt-2 flex flex-col">
          {sorted.map((task) => {
            const isDone = task.status === 'completed'
            return (
              <li key={task.id} className="flex min-h-11 items-center gap-1">
                {/* 44px tap target around the numbered circle, so it stays round on phones. */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!isDone) {
                      setJustDone(task.id)
                      tapFeedback()
                    }
                    void run(() => setTaskStatus(task.id, isDone ? 'not_started' : 'completed'))
                  }}
                  aria-label={isDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                  className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill"
                >
                  <span
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-pill border-2 text-sm font-medium transition-colors',
                      isDone ? 'border-sage-dark bg-sage-dark text-white' : 'border-raspberry/50 text-raspberry-dark',
                      isDone && justDone === task.id && 'tick-pop'
                    )}
                  >
                    {isDone ? '✓' : task.rank}
                  </span>
                </button>
                <span className={clsx('min-w-0 flex-1 break-words text-sm', isDone ? 'text-ink-faint line-through' : 'text-ink')}>
                  {task.title}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => savePriority(task.rank, ''))}
                  aria-label={`Remove "${task.title}"`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink-faint hover:text-clay-dark"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {slotsLeft > 0 && firstFree !== undefined && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.slice(0, 3).map((s) => (
            <button
              key={s.title}
              type="button"
              disabled={busy}
              title={s.reason}
              onClick={() => run(() => savePriority(firstFree, s.title))}
              className="rounded-pill border border-dashed border-ink/20 px-3 py-1.5 text-left text-xs text-ink hover:border-raspberry"
            >
              + {s.title}
            </button>
          ))}
        </div>
      )}

      <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-2 border-t border-ink/10 pt-4">
        <div className="flex gap-2">
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Add a task for today…"
            aria-label="Task name"
            className="h-11 min-w-0 flex-1 rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry"
          />
          <AddButton />
        </div>
        <div className="flex items-center gap-2">
          <select
            name="category"
            defaultValue="business"
            aria-label="Category"
            className="h-10 min-w-0 flex-1 rounded-card border border-ink/15 bg-base px-2 text-sm outline-none focus:border-raspberry"
          >
            {TASK_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label
            className={clsx(
              'flex h-10 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-pill border px-3 text-sm font-medium transition-colors',
              starred ? 'border-raspberry bg-raspberry-soft text-raspberry-dark' : 'border-ink/15 text-ink-muted',
              slotsLeft === 0 && 'cursor-not-allowed opacity-40'
            )}
            title={slotsLeft === 0 ? 'You already have 3 priorities today' : 'Make this one of today’s priorities'}
          >
            <input
              type="checkbox"
              name="asPriority"
              checked={starred}
              disabled={slotsLeft === 0}
              onChange={(e) => setStarred(e.target.checked)}
              className="sr-only"
            />
            <span aria-hidden="true">{starred ? '★' : '☆'}</span> Priority
          </label>
        </div>
      </form>

      {(error || state.error) && (
        <p role="alert" className="mt-2 text-sm text-clay-dark">
          {error ?? state.error}
        </p>
      )}
    </Card>
  )
}

function AddButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 shrink-0 rounded-pill bg-raspberry px-5 text-sm font-medium text-white transition-colors hover:bg-raspberry-dark disabled:opacity-50"
    >
      {pending ? 'Adding…' : 'Add'}
    </button>
  )
}
