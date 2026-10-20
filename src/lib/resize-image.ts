/**
 * Shrinks a photo in the browser and re-encodes it as JPEG. Phone photos are
 * often 3–8 MB; this makes them ~50–300 KB, so uploads are quick and the free
 * storage lasts. Browser-only (uses canvas).
 *
 *   maxSize  longest side in pixels
 *   square   crop to a centred square first (profile photos)
 */
export async function resizeToJpeg(file: File, { maxSize, square = false }: { maxSize: number; square?: boolean }): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode() // browsers apply the photo's EXIF rotation here

    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const source = square
      ? { x: (img.naturalWidth - side) / 2, y: (img.naturalHeight - side) / 2, w: side, h: side }
      : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }
    const scale = Math.min(1, maxSize / Math.max(source.w, source.h))

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(source.w * scale)
    canvas.height = Math.round(source.h * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas')
    ctx.fillStyle = '#ffffff' // transparent PNGs get a white background instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, source.x, source.y, source.w, source.h, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encode failed'))), 'image/jpeg', 0.82)
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
