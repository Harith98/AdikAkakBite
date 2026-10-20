'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { updateBusinessDetails, type BusinessDetailsState } from '@/app/(app)/settings/actions'
import { socialHandle } from '@/lib/social'

const initialState: BusinessDetailsState = { error: null, nonce: 0 }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'
const textarea = 'w-full rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry'

export interface BusinessDetails {
  name: string
  ownerName: string | null
  phone: string | null
  email: string | null
  address: string | null
  registrationNumber: string | null
  receiptFooter: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  tiktokUrl?: string | null
  threadsUrl?: string | null
}

const SOCIAL = [
  { name: 'instagram', label: 'Instagram', key: 'instagramUrl', placeholder: '@adikakakbites' },
  { name: 'facebook', label: 'Facebook', key: 'facebookUrl', placeholder: 'facebook.com/adikakakbites' },
  { name: 'tiktok', label: 'TikTok', key: 'tiktokUrl', placeholder: '@adikakakbites' },
  { name: 'threads', label: 'Threads', key: 'threadsUrl', placeholder: '@adikakakbites' },
] as const

export function BusinessDetailsForm({ details }: { details: BusinessDetails }) {
  const [state, formAction] = useFormState(updateBusinessDetails, initialState)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Business name</span>
        <input name="name" required maxLength={120} defaultValue={details.name} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Owner name</span>
        <input name="ownerName" maxLength={120} defaultValue={details.ownerName ?? ''} placeholder="e.g. Aina" className={input} />
        <span className="text-xs text-ink-faint">Used in the greeting on the Today screen.</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Phone</span>
          <input name="phone" inputMode="tel" maxLength={30} defaultValue={details.phone ?? ''} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input name="email" type="email" maxLength={200} defaultValue={details.email ?? ''} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Address</span>
        <textarea name="address" rows={2} maxLength={300} defaultValue={details.address ?? ''} className={textarea} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Registration no. (SSM, optional)</span>
        <input name="registrationNumber" maxLength={50} defaultValue={details.registrationNumber ?? ''} placeholder="e.g. 202601012345 (003456789-X)" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Receipt message</span>
        <textarea
          name="receiptFooter"
          rows={2}
          maxLength={300}
          defaultValue={details.receiptFooter ?? ''}
          placeholder="Thank you for your order!"
          className={textarea}
        />
        <span className="text-xs text-ink-faint">Printed at the bottom of every receipt.</span>
      </label>
      <fieldset className="mt-2 flex flex-col gap-3 border-t border-ink/10 pt-4">
        <legend className="sr-only">Social media</legend>
        <p className="text-sm font-medium text-ink">Social media</p>
        <p className="-mt-2 text-xs text-ink-faint">Shown as buttons on your customer menu. Type your @handle or paste the link.</p>
        {(details.instagramUrl || details.facebookUrl || details.tiktokUrl) && <input type="hidden" name="hadSocial" value="1" />}
        {details.threadsUrl && <input type="hidden" name="hadThreads" value="1" />}
        {SOCIAL.map((s) => (
          <label key={s.name} className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted">{s.label}</span>
            <input
              name={s.name}
              maxLength={200}
              defaultValue={socialHandle(details[s.key]) || ''}
              placeholder={s.placeholder}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={input}
            />
          </label>
        ))}
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
      {state.nonce !== 0 && !state.error && <p className="text-sm text-sage-dark">Saved.</p>}
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Saving…' : 'Save details'}
    </Button>
  )
}
