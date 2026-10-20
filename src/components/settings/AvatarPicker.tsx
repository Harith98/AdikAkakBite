'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AVATAR_BUCKET, AVATAR_SIZE } from '@/lib/avatars'
import { AvatarCropper } from './AvatarCropper'
import { updateMyAvatar } from '@/app/(app)/settings/actions'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'

/** Your own profile photo: take or choose one, position it in the circle, change or remove it. */
export function AvatarPicker({ userId, name, initialUrl }: { userId: string; name: string; initialUrl: string | null }) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  /** The photo being cropped, while the crop window is open. */
  const [cropping, setCropping] = useState<File | null>(null)

  function choose(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '' // allow picking the same file again
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ ok: false, text: 'Please choose a photo.' })
      return
    }
    setMessage(null)
    setCropping(file) // → crop window → upload(blob)
  }

  async function upload(blob: Blob) {
    setCropping(null)
    setBusy(true)
    setMessage(null)
    try {
      const supabase = createClient()
      const path = `${userId}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
      if (error) throw error
      const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
      const result = await updateMyAvatar(publicUrl)
      if (result.error) {
        await supabase.storage.from(AVATAR_BUCKET).remove([path])
        throw new Error(result.error)
      }
      setUrl(publicUrl)
      setMessage({ ok: true, text: 'Photo updated.' })
      router.refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : ''
      setMessage({
        ok: false,
        text: /decode|encode|canvas/i.test(text)
          ? 'This photo format can’t be read here. Try a JPEG or PNG.'
          : 'Couldn’t upload the photo. Check your connection and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setMessage(null)
    const result = await updateMyAvatar(null).catch(() => ({ error: 'Could not remove it. Check your connection.' }))
    setBusy(false)
    if (result.error) {
      setMessage({ ok: false, text: result.error })
      return
    }
    setUrl(null)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-4">
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
      {cropping && (
        <AvatarCropper file={cropping} outputSize={AVATAR_SIZE} onCancel={() => setCropping(null)} onConfirm={upload} />
      )}
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        aria-label={url ? 'Change profile photo' : 'Add profile photo'}
        className="relative shrink-0 rounded-pill"
      >
        <Avatar url={url} name={name} size={72} />
        <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-pill border-2 border-base-card bg-raspberry text-xs text-white">
          {busy ? '…' : '📷'}
        </span>
      </button>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : url ? 'Change photo' : 'Add photo'}
        </Button>
        {url && (
          <Button type="button" variant="ghost" onClick={remove} disabled={busy} className="text-ink-muted">
            Remove
          </Button>
        )}
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-xs text-sage-dark' : 'text-xs text-clay-dark'}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
