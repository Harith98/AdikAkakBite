/** Supabase Storage bucket for profile photos (see supabase/schema.sql). */
export const AVATAR_BUCKET = 'avatars'

/** Profile photos are cropped to a square and shrunk to this many pixels. */
export const AVATAR_SIZE = 400

/** The storage path ("<user id>/<file>.jpg") of a profile photo in our bucket, or null for anything else. */
export function avatarFilePath(url: string | null | undefined, supabaseUrl: string | undefined): string | null {
  if (!url || !supabaseUrl) return null
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${AVATAR_BUCKET}/`
  if (!url.startsWith(prefix)) return null
  const path = decodeURIComponent(url.slice(prefix.length).split('?')[0] ?? '')
  return /^[0-9a-f-]{36}\/[\w.-]+\.jpg$/i.test(path) ? path : null
}

/** A person's profile photo, from their auth metadata (set in Settings → Your account). */
export function readAvatarUrl(metadata: Record<string, unknown> | undefined): string | null {
  const value = metadata?.avatar_url
  return typeof value === 'string' && /^https:\/\//.test(value) ? value : null
}
