'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_IMAGE_BUCKET, PRODUCT_IMAGE_MAX_SIZE } from '@/lib/product-images'
import { Button } from '@/components/ui/Button'
import { resizeToJpeg } from '@/lib/resize-image'

interface Props {
  businessId: string
  initialUrl: string | null
  /** Lets the form hold its Save button while a photo is still uploading. */
  onUploadingChange?: (uploading: boolean) => void
}

/** Product photo: take or choose a picture, see it, change or remove it. Submits the photo's URL as `imageUrl`. */
export function ProductImagePicker({ businessId, initialUrl, onUploadingChange }: Props) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function setBusy(value: boolean) {
    setUploading(value)
    onUploadingChange?.(value)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const blob = await resizeToJpeg(file, { maxSize: PRODUCT_IMAGE_MAX_SIZE })
      const path = `${businessId}/${crypto.randomUUID()}.jpg`
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
      if (uploadError) throw uploadError
      setUrl(supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(
        /decode|encode|canvas/i.test(message)
          ? 'This photo format can’t be read here. Try a JPEG or PNG, or take a screenshot of it.'
          : 'Couldn’t upload the photo. Check your connection and try again.'
      )
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = '' // allow picking the same file again
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-ink">Photo</span>
      <input type="hidden" name="imageUrl" value={url} />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          aria-label={url ? 'Change photo' : 'Add photo'}
          className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-card border-2 border-dashed border-ink/15 bg-base-soft text-ink-faint hover:border-raspberry"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-xs font-medium text-ink">
              Uploading…
            </span>
          )}
        </button>

        <div className="flex flex-col items-start gap-1">
          <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {url ? 'Change photo' : 'Add photo'}
          </Button>
          {url && (
            <Button type="button" variant="ghost" onClick={() => setUrl('')} disabled={uploading} className="text-ink-muted">
              Remove
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-clay-dark">
          {error}
        </p>
      ) : (
        <p className="text-xs text-ink-muted">Take a photo or choose one from your gallery. The change is kept when you save.</p>
      )}
    </div>
  )
}
