/** Supabase Storage bucket for product photos (see supabase/schema.sql). */
export const PRODUCT_IMAGE_BUCKET = 'product-images'

/** Longest side of an uploaded photo, in pixels. Big enough for a phone screen, small enough to load fast. */
export const PRODUCT_IMAGE_MAX_SIZE = 1200

/** Longest side of the small copy used in grids and lists (sharp at tile size on phone screens, ~30–60 KB). */
export const PRODUCT_THUMB_MAX_SIZE = 480

/**
 * Each upload is saved twice: "<id>_full.jpg" and a small "<id>_thumb.jpg" beside it.
 * Photos from before thumbnails (no "_full") have only the one file.
 */
const FULL_SUFFIX = '_full.jpg'
const THUMB_SUFFIX = '_thumb.jpg'

/** Storage file names for a new upload. */
export function productImageFileNames(businessId: string, id: string) {
  return { full: `${businessId}/${id}${FULL_SUFFIX}`, thumb: `${businessId}/${id}${THUMB_SUFFIX}` }
}

/** The small copy of a photo for tiles and lists; the photo itself when it has no small copy. */
export function productThumbUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const [base, query] = url.split('?')
  if (!base?.endsWith(FULL_SUFFIX)) return url
  return base.slice(0, -FULL_SUFFIX.length) + THUMB_SUFFIX + (query ? `?${query}` : '')
}

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
