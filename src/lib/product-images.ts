/** Supabase Storage bucket for product photos (migration 0018). */
export const PRODUCT_IMAGE_BUCKET = 'product-images'

/** Longest side of an uploaded photo, in pixels. Big enough for a phone screen, small enough to load fast. */
export const PRODUCT_IMAGE_MAX_SIZE = 1200

/**
 * The storage path ("<business id>/<file>.jpg") of a photo in our bucket, or
 * null for anything else (an older pasted link, another site). Used to delete
 * the old file when a photo is replaced or its product deleted.
 */
export function productImagePath(url: string | null | undefined, supabaseUrl: string | undefined): string | null {
  if (!url || !supabaseUrl) return null
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`
  if (!url.startsWith(prefix)) return null
  const path = decodeURIComponent(url.slice(prefix.length).split('?')[0] ?? '')
  return /^[0-9a-f-]{36}\/[\w.-]+$/i.test(path) ? path : null
}
