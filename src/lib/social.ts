/**
 * The shop's social links. People type a handle ("@adikakakbites"), a bare
 * address ("instagram.com/adikakakbites") or a full link; all become a clean
 * https link to that platform. Anything pointing at a different site is refused.
 */
export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok'

const SITES: Record<SocialPlatform, { hosts: string[]; base: string; label: string }> = {
  instagram: { hosts: ['instagram.com', 'www.instagram.com'], base: 'https://www.instagram.com/', label: 'Instagram' },
  facebook: { hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com'], base: 'https://www.facebook.com/', label: 'Facebook' },
  tiktok: { hosts: ['tiktok.com', 'www.tiktok.com'], base: 'https://www.tiktok.com/@', label: 'TikTok' },
}

export type SocialResult = { ok: true; url: string | null } | { ok: false; error: string }

export function normalizeSocialLink(platform: SocialPlatform, raw: string): SocialResult {
  const site = SITES[platform]
  const input = raw.trim()
  if (!input) return { ok: true, url: null }

  // A handle: letters, numbers, dots and underscores (optionally starting with @),
  // unless it looks like a web address ("facebook.com", "instagram.com/x").
  const handle = input.replace(/^@/, '')
  const looksLikeAddress = input.includes('/') || /\.(com|net|org|my|co)$/i.test(handle)
  if (!looksLikeAddress && /^[A-Za-z0-9._]{1,60}$/.test(handle)) return { ok: true, url: site.base + handle }

  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
    if (!site.hosts.includes(url.hostname.toLowerCase())) {
      return { ok: false, error: `That ${site.label} link doesn't look right. Use your @handle or a ${site.hosts[0]} link.` }
    }
    const path = url.pathname.replace(/\/+$/, '')
    if (!path || path === '/') return { ok: false, error: `Add your ${site.label} @handle, not just the site.` }
    return { ok: true, url: `https://${site.hosts[site.hosts.length > 1 ? 1 : 0]}${path}` }
  } catch {
    return { ok: false, error: `That ${site.label} link doesn't look right. Use your @handle.` }
  }
}

/** "https://www.instagram.com/adikakakbites" → "@adikakakbites" (for showing in forms). */
export function socialHandle(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
    return last ? `@${last.replace(/^@/, '')}` : url
  } catch {
    return url
  }
}
