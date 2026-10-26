'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATALOGUE_BUCKET, CATALOGUE_LARGE_BYTES, CATALOGUE_MAX_BYTES } from '@/lib/catalogue'
import { formatBytes } from '@/lib/system-status'
import { removeCatalogue, saveCatalogue } from '@/app/(app)/settings/menu/actions'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/Feedback'

interface Props {
  businessId: string
  currentUrl: string | null
  updatedLabel: string | null
}

/** Upload, replace or remove the PDF catalogue shown on the customer menu. */
export function CatalogueManager({ businessId, currentUrl, updatedLabel }: Props) {
  const ask = useConfirm()
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function upload(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '' // allow choosing the same file again
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setMessage({ ok: false, text: 'Please choose a PDF file.' })
      return
    }
    if (file.size > CATALOGUE_MAX_BYTES) {
      setMessage({ ok: false, text: `That PDF is ${formatBytes(file.size)}. The limit is ${formatBytes(CATALOGUE_MAX_BYTES)}; export it smaller (Canva → Download → PDF Standard / compress).` })
      return
    }
    setBusy('upload')
    setMessage(null)
    try {
      const supabase = createClient()
      const path = `${businessId}/catalogue-${crypto.randomUUID()}.pdf`
      const { error } = await supabase.storage
        .from(CATALOGUE_BUCKET)
        .upload(path, file, { contentType: 'application/pdf', cacheControl: '31536000', upsert: false })
      if (error) throw error
      const url = supabase.storage.from(CATALOGUE_BUCKET).getPublicUrl(path).data.publicUrl
      const result = await saveCatalogue(url)
      if (result.error) {
        await supabase.storage.from(CATALOGUE_BUCKET).remove([path]) // don't leave an unused file behind
        throw new Error(result.error)
      }
      setMessage({
        ok: true,
        text:
          file.size > CATALOGUE_LARGE_BYTES
            ? `Uploaded. It's ${formatBytes(file.size)}, which is slow to open on mobile data; a smaller export (under 10 MB) helps customers.`
            : 'Uploaded. Customers see the new menu now.',
      })
      router.refresh()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error && err.message ? `Upload failed: ${err.message}` : 'Upload failed. Check your connection and try again.' })
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!(await ask({ title: 'Remove the catalogue?', message: 'Customers won’t see it on the menu. The order form stays.', confirmLabel: 'Remove', danger: true }))) return
    setBusy('remove')
    setMessage(null)
    const result = await removeCatalogue().catch(() => ({ error: 'Could not remove it. Check your connection.' }))
    setBusy(null)
    if (result.error) setMessage({ ok: false, text: result.error })
    else router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />

      {currentUrl ? (
        <div className="flex items-center gap-3 rounded-card border border-ink/10 bg-base-soft p-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-raspberry-soft text-xs font-bold text-raspberry-dark">
            PDF
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Current catalogue</span>
            {updatedLabel && <span className="block text-xs text-ink-muted">Updated {updatedLabel}</span>}
          </span>
          <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-medium text-raspberry-dark">
            View ↗
          </a>
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-ink/15 p-3 text-sm text-ink-muted">
          No catalogue yet. Customers will only see the order form until you upload one.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
          {busy === 'upload' ? 'Uploading…' : currentUrl ? 'Replace PDF' : 'Upload PDF'}
        </Button>
        {currentUrl && (
          <Button type="button" variant="secondary" onClick={remove} disabled={busy !== null}>
            {busy === 'remove' ? 'Removing…' : 'Remove'}
          </Button>
        )}
      </div>

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-sm text-sage-dark' : 'text-sm text-clay-dark'}>
          {message.text}
        </p>
      )}
      <p className="text-xs text-ink-muted">PDF up to {formatBytes(CATALOGUE_MAX_BYTES)}. Under 10 MB opens quickly on phones.</p>
    </div>
  )
}
