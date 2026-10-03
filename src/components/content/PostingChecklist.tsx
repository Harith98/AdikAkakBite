'use client'

import { useEffect, useState } from 'react'
import clsx from '@/lib/clsx'
import { CHECKLIST_PLATFORMS, PLATFORM_LABELS, type ChecklistPlatform } from '@/lib/content'
import { setPostedToday } from '@/app/(app)/content/actions'
import { PlatformIcon } from './PlatformIcon'

/** Opens the app itself on phones; the website on computers (WhatsApp has no "home" web URL besides WhatsApp Web). */
function platformHref(platform: ChecklistPlatform, touch: boolean): string {
  if (platform === 'instagram') return 'https://www.instagram.com/'
  if (platform === 'facebook') return 'https://www.facebook.com/'
  return touch ? 'whatsapp://' : 'https://web.whatsapp.com/'
}

interface Props {
  /** Platform → time it was ticked today ("3:24 pm"), for the ones already posted. */
  postedAt: Partial<Record<ChecklistPlatform, string>>
}

export function PostingChecklist({ postedAt }: Props) {
  const [posted, setPosted] = useState(() => new Set(Object.keys(postedAt) as ChecklistPlatform[]))
  const [pending, setPending] = useState<ChecklistPlatform | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [touch, setTouch] = useState(false)

  useEffect(() => setTouch(window.matchMedia('(pointer: coarse)').matches), [])

  async function toggle(platform: ChecklistPlatform) {
    const next = !posted.has(platform)
    setError(null)
    setPending(platform)
    setPosted((s) => {
      const copy = new Set(s)
      if (next) copy.add(platform)
      else copy.delete(platform)
      return copy
    })
    const result = await setPostedToday(platform, next).catch(() => ({ error: 'Could not save. Check your connection.' }))
    if (result.error) {
      setError(result.error)
      setPosted((s) => {
        const copy = new Set(s)
        if (next) copy.delete(platform)
        else copy.add(platform)
        return copy
      })
    }
    setPending(null)
  }

  const done = CHECKLIST_PLATFORMS.filter((p) => posted.has(p)).length

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Posted today</p>
        <p className={clsx('text-sm font-medium', done === CHECKLIST_PLATFORMS.length ? 'text-sage-dark' : 'text-ink-muted')}>
          {done === CHECKLIST_PLATFORMS.length ? 'All done 🎉' : `${done} of ${CHECKLIST_PLATFORMS.length}`}
        </p>
      </div>

      <ul className="mt-3 flex flex-col divide-y divide-ink/5">
        {CHECKLIST_PLATFORMS.map((platform) => {
          const isPosted = posted.has(platform)
          const label = PLATFORM_LABELS[platform]
          return (
            <li key={platform} className="flex items-center gap-3 py-3">
              <a
                href={platformHref(platform, touch)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${label}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-card"
              >
                <PlatformIcon platform={platform} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{label}</span>
                  <span className="block text-xs text-ink-muted">
                    {isPosted ? (postedAt[platform] ? `Posted at ${postedAt[platform]}` : 'Posted') : 'Tap to open ↗'}
                  </span>
                </span>
              </a>
              {/* 44px tap target around the tick, so it stays round on phones. */}
              <button
                type="button"
                onClick={() => toggle(platform)}
                disabled={pending === platform}
                aria-pressed={isPosted}
                aria-label={isPosted ? `Mark ${label} as not posted today` : `Mark ${label} as posted today`}
                className="group -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill disabled:opacity-60"
              >
                <span
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-pill border-2 transition-colors',
                    isPosted ? 'border-sage-dark bg-sage-dark text-white' : 'border-ink-faint text-transparent group-hover:border-raspberry'
                  )}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-2 text-sm text-clay-dark">
          {error}
        </p>
      )}
    </div>
  )
}
