'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { completeOnboarding, type OnboardingFormState } from './actions'

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

const initialState: OnboardingFormState = { error: null }

export function OnboardingForm() {
  const [state, formAction] = useFormState(completeOnboarding, initialState)

  return (
    <div className="min-h-dvh bg-base px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-ink">Let&apos;s set up your business</p>
          <p className="mt-1 text-sm text-ink-muted">
            Just the basics for now — you can add products, prices and inventory once you&apos;re in.
          </p>
        </div>

        <Card>
          <form action={formAction} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">Business name</span>
              <input
                name="businessName"
                required
                placeholder="e.g. Sweet Batch Desserts"
                className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">Owner name</span>
              <input
                name="ownerName"
                placeholder="Your name"
                className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">Opens at</span>
                <input
                  type="time"
                  name="workingHoursStart"
                  defaultValue="11:00"
                  className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">Closes at</span>
                <input
                  type="time"
                  name="workingHoursEnd"
                  defaultValue="20:00"
                  className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
                />
              </label>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Working days</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day.value}
                    className="flex h-10 min-w-[3rem] cursor-pointer items-center justify-center rounded-pill border border-ink/15 px-3 text-sm has-[:checked]:border-raspberry has-[:checked]:bg-raspberry-soft has-[:checked]:text-raspberry"
                  >
                    <input
                      type="checkbox"
                      name="workingDays"
                      value={day.value}
                      defaultChecked
                      className="sr-only"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {state.error && <p className="text-sm text-clay">{state.error}</p>}

            <SubmitButton />

            <p className="text-center text-xs text-ink-faint">
              We&apos;ll set up the default daily schedule for you — you can edit every block later in
              Settings.
            </p>
          </form>
        </Card>
      </div>
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Setting up…' : 'Finish setup'}
    </Button>
  )
}
