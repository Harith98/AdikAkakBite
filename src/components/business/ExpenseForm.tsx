'use client'

import { useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import clsx from '@/lib/clsx'
import { EXPENSE_CATEGORIES } from '@/lib/expenses'
import type { ExpenseCategory } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/Button'
import {
  addExpense,
  changeMonthlyAmount,
  deleteExpense,
  stopRepeatingExpense,
  type AddExpenseState,
  type ChangeAmountState,
} from '@/app/(app)/business/expenses/actions'
import { ConfirmForm, useSuccessToast } from '@/components/ui/Feedback'

const initialState: AddExpenseState = { error: null, nonce: 0 }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

/** Add an overhead: what it was for, how much, when, and whether it repeats monthly (rent, bills). */
export function ExpenseForm({ today }: { today: string }) {
  const [state, formAction] = useFormState(addExpense, initialState)
  useSuccessToast(state, 'Expense added')
  // A fresh, empty form after each save.
  return <ExpenseFields key={state.nonce} today={today} formAction={formAction} state={state} />
}

function ExpenseFields({ today, formAction, state }: { today: string; formAction: (data: FormData) => void; state: AddExpenseState }) {
  const [category, setCategory] = useState<ExpenseCategory | null>(null)
  const hint = EXPENSE_CATEGORIES.find((c) => c.key === category)?.hint
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="mb-1.5 font-medium text-ink">What was it for?</legend>
        <div className="grid grid-cols-3 gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <label
              key={c.key}
              className={clsx(
                'flex cursor-pointer flex-col items-center gap-1 rounded-card border px-1 py-2 text-center text-xs font-medium transition-colors',
                category === c.key ? 'border-raspberry bg-raspberry-soft text-raspberry-dark' : 'border-ink/10 bg-base text-ink-muted hover:border-raspberry/40'
              )}
            >
              <input type="radio" name="category" value={c.key} required checked={category === c.key} onChange={() => setCategory(c.key)} className="sr-only" />
              <span aria-hidden="true" className="text-xl">
                {c.emoji}
              </span>
              {c.label}
            </label>
          ))}
        </div>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Amount (RM)</span>
          <input name="amount" inputMode="decimal" required placeholder="0.00" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Date paid</span>
          <input name="expenseDate" type="date" required defaultValue={today} max={today} className={input} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          Note <span className="font-normal text-ink-faint">(optional)</span>
        </span>
        <input name="note" maxLength={200} placeholder="e.g. TNB bill, Shopee boost" className={input} />
      </label>

      <label className="flex items-start gap-3 rounded-card bg-base-soft px-3 py-2.5 text-sm">
        <input type="checkbox" name="repeatsMonthly" className="mt-0.5 h-5 w-5 shrink-0 accent-raspberry" />
        <span>
          <span className="block font-medium text-ink">🔁 Repeats every month</span>
          <span className="block text-xs text-ink-muted">For fixed costs like rent. Counted every month on the same day until you stop it.</span>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-clay-dark">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending}>
      {pending ? 'Adding…' : 'Add expense'}
    </Button>
  )
}

/** Delete one expense (a repeating one goes from every month), after a confirm. */
export function DeleteExpenseButton({ id, repeating }: { id: string; repeating: boolean }) {
  return (
    <ConfirmForm
      action={deleteExpense}
      confirm={
        repeating
          ? {
              title: 'Delete from every month?',
              message: 'This monthly expense is removed from past months too. To only stop it from now on, use Stop instead.',
              confirmLabel: 'Delete',
              danger: true,
            }
          : { title: 'Delete this expense?', confirmLabel: 'Delete', danger: true }
      }
    >
      <input type="hidden" name="expenseId" value={id} />
      <button type="submit" className="rounded-pill px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-clay-soft hover:text-clay-dark">
        Delete
      </button>
    </ConfirmForm>
  )
}

/** Stop a monthly expense after this month; past months keep it. */
export function StopRepeatingButton({ id }: { id: string }) {
  return (
    <ConfirmForm
      action={stopRepeatingExpense}
      confirm={{ title: 'Stop after this month?', message: 'Past months keep it; from next month it’s no longer counted.', confirmLabel: 'Stop it' }}
    >
      <input type="hidden" name="expenseId" value={id} />
      <button type="submit" className="rounded-pill bg-base-soft px-2.5 py-1 text-xs font-medium text-ink hover:bg-amber-soft">
        Stop
      </button>
    </ConfirmForm>
  )
}

const changeInitial: ChangeAmountState = { error: null, nonce: 0 }

/** "Change" on a monthly cost: the new amount applies from this month; earlier months keep the old one. */
export function ChangeAmountButton({ id, label, amount }: { id: string; label: string; amount: number }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useFormState(changeMonthlyAmount, changeInitial)
  useSuccessToast(state, `${label}: new amount from this month`)
  useEffect(() => {
    if (state.nonce !== 0 && !state.error) setOpen(false)
  }, [state.nonce, state.error])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-pill bg-base-soft px-2.5 py-1 text-xs font-medium text-ink hover:bg-raspberry-soft">
        Change
      </button>
    )
  }
  return (
    <form action={formAction} className="mt-2 flex w-full flex-col gap-2 rounded-card bg-base-soft p-3">
      <input type="hidden" name="expenseId" value={id} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">New monthly amount (RM)</span>
        <input name="amount" inputMode="decimal" required autoFocus defaultValue={String(amount)} className={input} />
      </label>
      <p className="text-xs text-ink-muted">From this month. Earlier months keep the old amount, and no month counts both.</p>
      {state.error && (
        <p role="alert" className="text-sm text-clay-dark">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <ChangeSubmit />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ChangeSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending}>
      Save new amount
    </Button>
  )
}
