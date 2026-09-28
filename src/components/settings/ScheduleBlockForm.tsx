'use client'

import { useEffect, useRef } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { TASK_CATEGORY_OPTIONS } from '@/lib/constants'
import {
  deleteScheduleBlock,
  saveScheduleBlock,
  type ScheduleFormState,
} from '@/app/(app)/settings/schedule/actions'

export interface ScheduleBlockFormValues {
  id: string
  title: string
  category: string
  startTime: string
  endTime: string
  defaultTasks: string[]
  isActive: boolean
}

const initialState: ScheduleFormState = { error: null, nonce: 0 }
const inputClass = 'h-11 rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

export function ScheduleBlockForm({ block }: { block?: ScheduleBlockFormValues }) {
  const [state, formAction] = useFormState(saveScheduleBlock, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // After adding a NEW block, clear the form. Editing keeps the values.
  useEffect(() => {
    if (!block && state.nonce !== 0) formRef.current?.reset()
  }, [block, state.nonce])

  return (
    <div>
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={block?.id ?? ''} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Name</span>
          <input name="title" required maxLength={120} defaultValue={block?.title} className={inputClass} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Starts</span>
            <input type="time" name="startTime" required defaultValue={block?.startTime} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Ends</span>
            <input type="time" name="endTime" required defaultValue={block?.endTime} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Category</span>
            <select name="category" defaultValue={block?.category ?? 'business'} className={inputClass}>
              {TASK_CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Tasks (one per line)</span>
          <textarea
            name="defaultTasks"
            rows={5}
            defaultValue={block?.defaultTasks.join('\n')}
            className="rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isActive" defaultChecked={block?.isActive ?? true} className="h-4 w-4" />
          Active
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-clay-dark">
            {state.error}
          </p>
        )}
        {state.nonce !== 0 && !state.error && <p className="text-sm text-sage-dark">Saved.</p>}
        <SaveButton label={block ? 'Save changes' : 'Add block'} />
      </form>

      {block && (
        <form
          action={deleteScheduleBlock}
          onSubmit={(e) => {
            if (!confirm(`Delete "${block.title}"? Tasks already created for today will stay.`)) e.preventDefault()
          }}
          className="mt-2"
        >
          <input type="hidden" name="id" value={block.id} />
          <Button type="submit" variant="ghost" className="w-full text-clay-dark">
            Delete block
          </Button>
        </form>
      )}
    </div>
  )
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Saving…' : label}
    </Button>
  )
}
