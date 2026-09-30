'use client'

import { useEffect } from 'react'

/**
 * Registers /sw.js on mount. Kept as its own tiny client component so the
 * root layout can stay a Server Component.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return // avoid caching issues during local dev

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err)
      })
    }

    // Hydration can finish after `load` has already fired, in which case a
    // load listener would never run and the worker would never register.
    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
