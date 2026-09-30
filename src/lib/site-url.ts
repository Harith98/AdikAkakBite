/**
 * The app's public address, for links that leave the browser — shared sign-in links
 * and the redirect in Supabase's confirmation / sign-in emails.
 *
 * Never use window.location.origin for these: opened from a Vercel preview
 * deployment (…-git-main-….vercel.app), that points at a URL protected by
 * Vercel Authentication, so the recipient lands on a "Log in to Vercel" page.
 *
 * Order: NEXT_PUBLIC_SITE_URL (set this if you add a custom domain) →
 * the production domain in any production build (previews included) →
 * the current origin in local development.
 */
export const PRODUCTION_SITE_URL = 'https://adik-akak-bite.vercel.app'

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') return PRODUCTION_SITE_URL
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
}

/** Where Supabase should send someone after they click the link in an auth email. */
export function authCallbackUrl(next: string): string {
  return `${siteUrl()}/api/auth/callback?next=${encodeURIComponent(next)}`
}
