'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

/** The customer menu's link, with copy / share / open. */
export function MenuLinkShare({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy the menu link:', url)
    }
  }

  const shareText = `Assalamualaikum! Ini menu kami. Isi borang dan hantar tempahan terus di WhatsApp: ${url}`

  return (
    <div className="flex flex-col gap-2">
      <p className="break-all rounded-card bg-base-soft px-3 py-2 font-mono text-sm text-ink">{url}</p>
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-pill border border-ink/10 bg-base-soft px-3 text-sm font-medium text-ink"
        >
          Share
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-pill border border-ink/10 bg-base-soft px-3 text-sm font-medium text-ink"
        >
          Open ↗
        </a>
      </div>
      <p className="text-xs text-ink-muted">Put this in your Instagram bio and WhatsApp status.</p>
    </div>
  )
}
