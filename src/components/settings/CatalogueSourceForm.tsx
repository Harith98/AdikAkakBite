'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import clsx from '@/lib/clsx'
import { CATALOGUE_MODES, type CatalogueMode } from '@/lib/catalogue'
import { saveCatalogueSource, type CatalogueSourceState } from '@/app/(app)/settings/menu/actions'
import { Button } from '@/components/ui/Button'
import { useSuccessToast } from '@/components/ui/Feedback'

const initialState: CatalogueSourceState = { error: null, nonce: 0 }

/** The catalogue link (Canva / Google Drive) and what "View catalogue" opens: the PDF, the link, or the PDF switching to the link at 80%. */
export function CatalogueSourceForm({ link, mode, hasPdf }: { link: string | null; mode: CatalogueMode; hasPdf: boolean }) {
  const [state, formAction] = useFormState(saveCatalogueSource, initialState)
  const [chosen, setChosen] = useState<CatalogueMode>(mode)
  useSuccessToast(state, 'Catalogue settings saved')

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Catalogue link</span>
        <input
          name="link"
          type="url"
          inputMode="url"
          defaultValue={link ?? ''}
          placeholder="https://www.canva.com/design/…/view"
          className="h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry"
        />
        <span className="text-xs text-ink-muted">
          Canva: Share → View-only link. Google Drive: Share → General access: Anyone with the link → Copy link. Customers opening it use none of
          the app’s free data.
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">What “View catalogue” opens</legend>
        {CATALOGUE_MODES.map((m) => (
          <label
            key={m.value}
            className={clsx(
              'flex cursor-pointer items-start gap-3 rounded-card border px-3 py-2.5 text-sm',
              chosen === m.value ? 'border-raspberry bg-raspberry-soft/50' : 'border-ink/10'
            )}
          >
            <input type="radio" name="mode" value={m.value} checked={chosen === m.value} onChange={() => setChosen(m.value)} className="mt-0.5 h-4 w-4 accent-raspberry" />
            <span>
              <span className="block font-medium text-ink">{m.label}</span>
              <span className="block text-xs text-ink-muted">{m.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {!hasPdf && <p className="text-xs text-ink-muted">No PDF uploaded: customers get the link whichever option is chosen.</p>}

      {state.error && (
        <p role="alert" className="text-sm text-clay-dark">
          {state.error}
        </p>
      )}
      <SaveButton />
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending}>
      Save
    </Button>
  )
}
