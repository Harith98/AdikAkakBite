'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_IMAGE_BUCKET, PRODUCT_IMAGE_MAX_SIZE, PRODUCT_THUMB_MAX_SIZE, productImageFileNames, productImagePath } from '@/lib/product-images'
import { Button } from '@/components/ui/Button'
import { PhotoCropper } from '@/components/ui/PhotoCropper'
import { resizeToJpeg } from '@/lib/resize-image'

interface Props {
  businessId: string
  initialUrl: string | null
  /** Lets the form hold its Save button while a photo is still uploading. */
  onUploadingChange?: (uploading: boolean) => void
}

/**
 * Product photo: take or choose a picture, frame it as a square (how it shows
 * in the product grid), see it, adjust, change or remove it. Submits the
 * photo's URL as `imageUrl`.
 */
export function ProductImagePicker({ businessId, initialUrl, onUploadingChange }: Props) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [cropping, setCropping] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Only photos in our own storage can be re-opened for adjusting (others may block it).
  const canAdjust = Boolean(url && productImagePath(url, process.env.NEXT_PUBLIC_SUPABASE_URL))

  function setBusy(value: boolean) {
    setUploading(value)
    onUploadingChange?.(value)
  }

  function choose(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '' // allow picking the same file again
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo.')
      return
    }
    setError(null)
    setCropping(file)
  }

  /** Re-open the current photo in the cropper. */
  async function adjust() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch')
      setCropping(await res.blob())
    } catch {
      setError('Couldn’t open this photo to adjust it. Choose it again with Change photo.')
    } finally {
      setBusy(false)
    }
  }

  /** Upload the framed photo plus a small copy for grids and lists (named to match, see productThumbUrl). */
  async function upload(cropped: Blob) {
    setCropping(null)
    setBusy(true)
    try {
      const thumb = await resizeToJpeg(cropped, { maxSize: PRODUCT_THUMB_MAX_SIZE })
      const paths = productImageFileNames(businessId, crypto.randomUUID())
      const bucket = createClient().storage.from(PRODUCT_IMAGE_BUCKET)
      const options = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }
      // Small copy first: once the photo exists, its small copy always does too.
      const { error: thumbError } = await bucket.upload(paths.thumb, thumb, options)
      if (thumbError) throw thumbError
      const { error: uploadError } = await bucket.upload(paths.full, cropped, options)
      if (uploadError) {
        await bucket.remove([paths.thumb])
        throw uploadError
      }
      setUrl(bucket.getPublicUrl(paths.full).data.publicUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(
        /decode|encode|canvas/i.test(message)
          ? 'This photo format can’t be read here. Try a JPEG or PNG, or take a screenshot of it.'
          : 'Couldn’t upload the photo. Check your connection and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-ink">Photo</span>
      <input type="hidden" name="imageUrl" value={url} />
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
      {cropping && (
        <PhotoCropper
          file={cropping}
          outputSize={PRODUCT_IMAGE_MAX_SIZE}
          shape="square"
          title="Frame the photo"
          hint="This square is how it shows in your product grid. Drag to move · pinch or slide to zoom."
          onCancel={() => setCropping(null)}
          onConfirm={upload}
        />
      )}

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
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
          {canAdjust && (
            <Button type="button" variant="ghost" onClick={adjust} disabled={uploading} className="text-ink-muted">
              Adjust
            </Button>
          )}
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
        <p className="text-xs text-ink-muted">Take a photo or choose one from your gallery, then frame it. The change is kept when you save.</p>
      )}
    </div>
  )
}
