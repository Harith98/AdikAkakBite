'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/** Search as you type: updates ?q= shortly after typing stops, keeping the other filters. */
export function ProductSearchBox({ initial }: { initial: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = useState(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep in step when the URL changes elsewhere (e.g. "Clear").
  useEffect(() => setValue(initial), [initial])

  function update(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const query = new URLSearchParams(params.toString())
      if (next.trim()) query.set('q', next.trim())
      else query.delete('q')
      const qs = query.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 300)
  }

  return (
    <label className="relative block">
      <span className="sr-only">Search products</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => update(e.target.value)}
        placeholder="Search products"
        enterKeyHint="search"
        className="h-11 w-full rounded-pill border border-ink/15 bg-white pl-10 pr-4 text-sm outline-none transition-colors focus:border-raspberry focus:ring-2 focus:ring-raspberry/15"
      />
    </label>
  )
}
