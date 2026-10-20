/** Supabase Storage bucket for the customer menu's PDF catalogue (migration 0023). */
export const CATALOGUE_BUCKET = 'catalogue'

/** Matches the bucket's limit (the Supabase free plan's per-file maximum). */
export const CATALOGUE_MAX_BYTES = 50 * 1024 * 1024

/** Above this, warn that customers on mobile data will wait for it to open. */
export const CATALOGUE_LARGE_BYTES = 10 * 1024 * 1024

/** The storage path ("<business id>/<file>.pdf") of a catalogue in our bucket, or null for anything else. */
export function catalogueFilePath(url: string | null | undefined, supabaseUrl: string | undefined): string | null {
  if (!url || !supabaseUrl) return null
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${CATALOGUE_BUCKET}/`
  if (!url.startsWith(prefix)) return null
  const path = decodeURIComponent(url.slice(prefix.length).split('?')[0] ?? '')
  return /^[0-9a-f-]{36}\/[\w.-]+\.pdf$/i.test(path) ? path : null
}
