'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'

/** Actions above the receipt. Hidden when printing, so the PDF is just the receipt. */
export function ReceiptToolbar({
  orderId,
  whatsappText,
  whatsappNumber,
}: {
  orderId: string
  whatsappText: string
  /** Customer's number in wa.me format, or null to let the user pick a chat. */
  whatsappNumber: string | null
}) {
  const whatsappHref = `https://wa.me/${whatsappNumber ?? ''}?text=${encodeURIComponent(whatsappText)}`

  return (
    <div className="mb-4 flex flex-col gap-3 print:hidden">
      <Link href={`/orders/${orderId}`} className="text-sm text-ink-muted">
        ← Back to order
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-pill border border-ink/10 bg-base-soft px-4 text-sm font-medium text-ink hover:bg-amber-soft"
        >
          {whatsappNumber ? 'Send to customer' : 'Share on WhatsApp'}
        </a>
      </div>
      <p className="text-xs text-ink-muted">
        To send a PDF: tap Print / Save PDF, choose &ldquo;Save as PDF&rdquo;, then attach the file in WhatsApp.
      </p>
    </div>
  )
}
