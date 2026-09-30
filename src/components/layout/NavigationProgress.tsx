'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Thin progress bar at the top of the screen that starts the instant an
 * in-app link is tapped and finishes when the new URL has rendered.
 *
 * The App Router has no navigation events, so a navigation is detected by
 * listening for link clicks (capture phase, so it runs before Next's own
 * handler) and "done" is when the pathname/search params change.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState<number | null>(null)
  const trickle = useRef<number | undefined>(undefined)
  const safety = useRef<number | undefined>(undefined)

  // Finish whenever the URL actually changes.
  useEffect(() => {
    window.clearInterval(trickle.current)
    window.clearTimeout(safety.current)
    setProgress((p) => (p === null ? null : 100))
    const hide = window.setTimeout(() => setProgress(null), 250)
    return () => window.clearTimeout(hide)
  }, [pathname, searchParams])

  useEffect(() => {
    function start() {
      window.clearInterval(trickle.current)
      window.clearTimeout(safety.current)
      setProgress(12)
      // Ease toward 90% — it never "completes" until the page really arrives.
      trickle.current = window.setInterval(() => {
        setProgress((p) => (p === null || p >= 90 ? p : p + (90 - p) * 0.12))
      }, 200)
      // Never leave a stuck bar if something unexpected happens (e.g. the
      // server redirected back to the same URL).
      safety.current = window.setTimeout(() => {
        window.clearInterval(trickle.current)
        setProgress(null)
      }, 15000)
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start()
    }

    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.clearInterval(trickle.current)
      window.clearTimeout(safety.current)
    }
  }, [])

  if (progress === null) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className="h-full rounded-r-pill bg-raspberry shadow-[0_0_8px_rgba(0,0,0,0.15)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  )
}
