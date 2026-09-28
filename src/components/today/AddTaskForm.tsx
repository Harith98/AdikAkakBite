'use client'

import { useEffect, useRef } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TASK_CATEGORY_OPTIONS } from '@/lib/constants'
import { addTask, type AddTaskState } from '@/app/(app)/today/actions'

const initialState: AddTaskState = { error: null, nonce: 0 }

export function AddTaskForm() {
  const [state, formAction] = useFormState(addTask, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.nonce !== 0) formRef.current?.reset()
  }, [state.nonce])

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Add a task for today</p>
      <form ref={formRef} action={formAction} className="mt-3 flex flex-col gap-3">
        <input
          name="title"
          required
          maxLength={120}
          placeholder="e.g. Buy more packaging"
          aria-label="Task name"
          className="h-11 rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            name="category"
            defaultValue="business"
            aria-label="Category"
            className="h-11 rounded-card border border-ink/15 bg-base px-2 text-sm outline-none focus:border-raspberry"
          >
            {TASK_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            name="priority"
            defaultValue="0"
            aria-label="Priority"
            className="h-11 rounded-card border border-ink/15 bg-base px-2 text-sm outline-none focus:border-raspberry"
          >
            <option value="0">Normal</option>
            <option value="2">High</option>
          </select>
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-clay-dark">
            {state.error}
          </p>
        )}
        <SubmitButton />
      </form>
    </Card>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="w-full">
      {pending ? 'Adding…' : 'Add task'}
    </Button>
  )
}
