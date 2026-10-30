/** The menu's catalogue button: counts the open, then redirects to the PDF (app/menu/catalogue/route.ts). */
export const CATALOGUE_PATH = '/menu/catalogue'

/** Supabase Storage bucket for the customer menu's PDF catalogue (see supabase/schema.sql). */
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

/** What "View catalogue" opens: the uploaded PDF switching to the link at 80% (auto), always the PDF, or always the link. */
export type CatalogueMode = 'auto' | 'upload' | 'link'
export const CATALOGUE_MODES: { value: CatalogueMode; label: string; text: string }[] = [
  { value: 'auto', label: 'Automatic (recommended)', text: 'Your uploaded PDF, switching to the link by itself at 80% of the month’s free data. Back to the PDF on the 1st.' },
  { value: 'upload', label: 'Always the uploaded PDF', text: 'Even near the limit. You still get an alert at 80%.' },
  { value: 'link', label: 'Always the link', text: 'Uses none of the free data, however many people open it.' },
]

/** Share of the month's free data transfer at which "auto" switches to the link and the owner/admins are alerted. */
export const CATALOGUE_SWITCH_SHARE = 0.8

/** A catalogue link: an https address, e.g. a Canva view-only link or a Google Drive "anyone with the link" link. */
export function cleanCatalogueLink(raw: string): { ok: true; url: string | null } | { ok: false; error: string } {
  const input = raw.trim()
  if (!input) return { ok: true, url: null }
  if (input.length > 500) return { ok: false, error: 'That link is too long.' }
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
    if (url.protocol !== 'https:') return { ok: false, error: 'Use the https link (it starts with https://).' }
    return { ok: true, url: url.toString() }
  } catch {
    return { ok: false, error: 'That doesn’t look like a link. Copy it from Canva (Share → View-only link) or Google Drive (Share → Copy link).' }
  }
}
