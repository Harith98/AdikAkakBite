'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { setTaskStatus } from '@/app/(app)/today/actions'
import type { TaskStatus } from '@/lib/supabase/database.types'

/**
 * The core one-handed loop (spec §45): START → work → COMPLETE → next task.
 * Buttons shown depend on the task's current status.
 */
export function TaskControls({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(next: TaskStatus) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. This change can't be saved until your connection returns.")
      return
    }
    setError(null)
    setPending(true)
    try {
      const result = await setTaskStatus(taskId, next)
      if (result.error) setError(result.error)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const isStarted = status === 'in_progress'

  return (
    <div className="mt-4 flex flex-col gap-2">
      {isStarted ? (
        <Button variant="success" size="lg" className="w-full" disabled={pending} onClick={() => run('completed')}>
          Complete
        </Button>
      ) : (
        <Button size="lg" className="w-full" disabled={pending} onClick={() => run('in_progress')}>
          {status === 'paused' ? 'Resume' : 'Start'}
        </Button>
      )}
      <div className="flex gap-2">
        {isStarted ? (
          <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => run('paused')}>
            Pause
          </Button>
        ) : (
          <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => run('completed')}>
            Complete
          </Button>
        )}
        <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => run('skipped')}>
          Skip
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-clay-dark">
          {error}
        </p>
      )}
    </div>
  )
}
