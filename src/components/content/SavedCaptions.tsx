'use client'

import { useState, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import clsx from '@/lib/clsx'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Button } from '@/components/ui/Button'
import { deleteCaption, markCaptionUsed, saveCaption, type SaveCaptionState } from '@/app/(app)/content/actions'
import { useConfirm, useToast } from '@/components/ui/Feedback'

export interface SavedCaption {
  id: string
  title: string
  body: string
}

const input = 'w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

/** Copies text, with a fallback for browsers without the Clipboard API (older iPhones in some in-app browsers). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  }
}

/** Captions and hashtag sets written once, copied in one tap. Most used first. */
export function SavedCaptions({ captions }: { captions: SavedCaption[] }) {
  // null = no form open; 'new' = adding; otherwise the caption being edited.
  const [editing, setEditing] = useState<'new' | SavedCaption | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const ask = useConfirm()
  const toast = useToast()

  async function copy(caption: SavedCaption) {
    setError(null)
    if (!(await copyText(caption.body))) {
      setError('Couldn’t copy here. Press and hold the text to copy it instead.')
      return
    }
    setCopied(caption.id)
    toast('Copied. Paste it in your post')
    setTimeout(() => setCopied((c) => (c === caption.id ? null : c)), 2000)
    startTransition(() => void markCaptionUsed(caption.id))
  }

  async function remove(caption: SavedCaption) {
    if (!(await ask({ title: `Delete "${caption.title}"?`, confirmLabel: 'Delete', danger: true }))) return
    startTransition(async () => {
      const result = await deleteCaption(caption.id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel icon="📝">Saved captions</SectionLabel>
        {editing === null && (
          <button type="button" onClick={() => setEditing('new')} className="rounded-pill bg-raspberry-soft px-3 py-1.5 text-sm font-medium text-raspberry-dark">
            + New
          </button>
        )}
      </div>

      {editing !== null && (
        <CaptionForm key={editing === 'new' ? 'new' : editing.id} caption={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      )}

      {captions.length === 0 && editing === null ? (
        <p className="mt-3 rounded-card bg-base-soft px-3 py-3 text-sm text-ink-muted">
          Save captions you use again and again (how to order, a promo, your hashtags) and copy them in one tap when you post.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-ink/5">
          {captions.map((c) => (
            <li key={c.id} className="py-3 first:pt-0">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-ink-muted">{c.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(c)}
                  className={clsx(
                    'shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors',
                    copied === c.id ? 'bg-sage-soft text-sage-dark' : 'bg-raspberry text-white active:scale-95'
                  )}
                >
                  {copied === c.id ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <div className="mt-1.5 flex gap-1">
                <button type="button" onClick={() => setEditing(c)} className="rounded-pill px-2 py-0.5 text-xs text-ink-muted hover:bg-ink/5 hover:text-ink">
                  Edit
                </button>
                <button type="button" onClick={() => remove(c)} className="rounded-pill px-2 py-0.5 text-xs text-ink-muted hover:bg-clay-soft hover:text-clay-dark">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-clay-dark">
          {error}
        </p>
      )}
    </div>
  )
}

const initialState: SaveCaptionState = { error: null, nonce: 0 }

function CaptionForm({ caption, onDone }: { caption: SavedCaption | null; onDone: () => void }) {
  const [state, formAction] = useFormState(async (prev: SaveCaptionState, data: FormData) => {
    const result = await saveCaption(prev, data)
    if (!result.error) onDone()
    return result
  }, initialState)
  const [length, setLength] = useState(caption?.body.length ?? 0)

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 rounded-card border border-raspberry/20 bg-raspberry-soft/30 p-3">
      {caption && <input type="hidden" name="captionId" value={caption.id} />}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Name</span>
        <input name="title" required maxLength={60} defaultValue={caption?.title ?? ''} placeholder="e.g. Order info, Raya promo, Hashtags" className={clsx(input, 'h-11')} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex justify-between font-medium text-ink">
          Caption <span className={clsx('font-normal', length > 2200 ? 'text-clay-dark' : 'text-ink-faint')}>{length.toLocaleString('en-GB')} / 2,200</span>
        </span>
        <textarea
          name="body"
          required
          rows={6}
          maxLength={2200}
          defaultValue={caption?.body ?? ''}
          onChange={(e) => setLength(e.target.value.length)}
          placeholder={'Nak order? 🧁\nPilih dari menu kami, isi borang, terus WhatsApp!'}
          className={clsx(input, 'py-2.5')}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-clay-dark">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <SaveButton />
      </div>
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending}>
      {pending ? 'Saving…' : 'Save'}
    </Button>
  )
}
