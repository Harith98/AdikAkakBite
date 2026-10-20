'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'

/** Size of the on-screen crop area (CSS px). The saved photo is `outputSize` px. */
const VIEW = 260
const MAX_ZOOM = 4

interface Props {
  file: Blob
  /** Longest side of the saved square, in px (smaller if the crop itself is smaller). */
  outputSize: number
  /** 'circle' for profile photos (shown round), 'square' for product photos (shown in square tiles). */
  shape?: 'circle' | 'square'
  title?: string
  hint?: string
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

interface Pos {
  x: number
  y: number
}

/**
 * Pick the part of a photo to keep: drag to move, pinch / slider / scroll
 * wheel to zoom. Exports exactly what's inside the frame as a square JPEG
 * (profile photos are then shown round, product photos square).
 */
export function PhotoCropper({
  file,
  outputSize,
  shape = 'circle',
  title = 'Adjust your photo',
  hint = 'Drag to move · pinch or slide to zoom',
  onCancel,
  onConfirm,
}: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Pos>({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, Pos>())
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Close with Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  /** The smallest scale at which the photo still covers the whole crop area. */
  const baseScale = natural ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1
  const scale = baseScale * zoom

  /** Keep the photo covering the frame: no empty gaps at the edges. */
  const clamp = useCallback(
    (pos: Pos, s: number): Pos => {
      if (!natural) return pos
      const minX = VIEW - natural.w * s
      const minY = VIEW - natural.h * s
      return { x: Math.min(0, Math.max(minX, pos.x)), y: Math.min(0, Math.max(minY, pos.y)) }
    },
    [natural]
  )

  function onLoad() {
    const img = imgRef.current
    if (!img) return
    const n = { w: img.naturalWidth, h: img.naturalHeight }
    setNatural(n)
    const s = Math.max(VIEW / n.w, VIEW / n.h)
    setZoom(1)
    setOffset({ x: (VIEW - n.w * s) / 2, y: (VIEW - n.h * s) / 2 }) // start centred
  }

  /** Zoom around the middle of the frame, so what's in the centre stays there. */
  function setZoomCentered(nextZoom: number) {
    const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
    const oldScale = scale
    const newScale = baseScale * z
    const c = VIEW / 2
    setOffset(clamp({ x: c - (c - offset.x) * (newScale / oldScale), y: c - (c - offset.y) * (newScale / oldScale) }, newScale))
    setZoom(z)
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinchStart.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const previous = pointers.current.get(e.pointerId)
    if (!previous) return
    const current = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, current)

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values())
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      setZoomCentered(pinchStart.current.zoom * (distance / pinchStart.current.distance))
      return
    }
    if (pointers.current.size === 1) {
      setOffset((o) => clamp({ x: o.x + current.x - previous.x, y: o.y + current.y - previous.y }, scale))
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
  }

  async function confirm() {
    const img = imgRef.current
    if (!img || !natural) return
    setSaving(true)
    try {
      // The frame's square, in the photo's own pixels.
      const sx = -offset.x / scale
      const sy = -offset.y / scale
      const size = VIEW / scale
      const canvas = document.createElement('canvas')
      const out = Math.min(outputSize, Math.round(size)) || outputSize
      canvas.width = out
      canvas.height = out
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No canvas')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, out, out)
      ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/jpeg', 0.85)
      )
      onConfirm(blob)
    } catch {
      setError('Couldn’t crop this photo. Try another one.')
      setSaving(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-card bg-base-card p-5 shadow-card">
        <p className="font-display text-xl text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{hint}</p>

        <div
          className="relative mx-auto mt-4 touch-none select-none overflow-hidden rounded-card bg-ink/10"
          style={{ width: VIEW, height: VIEW, cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => setZoomCentered(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={onLoad}
              onError={() => setError('This photo can’t be opened here. Try a JPEG or PNG.')}
              className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
              style={
                natural
                  ? { width: natural.w, height: natural.h, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }
                  : { opacity: 0 }
              }
            />
          )}
          {/* Darken everything outside the circle; a square crop keeps the whole frame, with a thin outline. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 ring-2 ring-inset ring-white ${shape === 'circle' ? 'rounded-full' : 'rounded-card'}`}
            style={shape === 'circle' ? { boxShadow: '0 0 0 999px rgba(37, 38, 39, 0.55)' } : undefined}
          />
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm text-ink-muted">
          <span aria-hidden="true">−</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomCentered(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-raspberry"
          />
          <span aria-hidden="true">+</span>
        </label>

        {error && (
          <p role="alert" className="mt-3 text-sm text-clay-dark">
            {error}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={!natural || saving}>
            {saving ? 'Saving…' : 'Use photo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
