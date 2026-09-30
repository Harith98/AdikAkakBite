'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { RECEIPT_ELEMENT_ID } from '@/lib/receipts'

/** Receipt PDF width; the height follows the receipt's length, like a till roll. */
const PDF_WIDTH_MM = 100

/**
 * Draws the on-screen receipt into a one-page PDF. Libraries load only when
 * the button is tapped, so they don't slow down opening the receipt.
 */
async function buildReceiptPdf(fileName: string): Promise<File> {
  const element = document.getElementById(RECEIPT_ELEMENT_ID)
  if (!element) throw new Error('Receipt not found on the page.')
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])

  const png = await toPng(element, { pixelRatio: 2, backgroundColor: '#ffffff' })
  const heightMm = (element.offsetHeight / element.offsetWidth) * PDF_WIDTH_MM
  const pdf = new jsPDF({ unit: 'mm', format: [PDF_WIDTH_MM, heightMm], orientation: 'portrait', compress: true })
  pdf.addImage(png, 'PNG', 0, 0, PDF_WIDTH_MM, heightMm)
  return new File([pdf.output('blob')], fileName, { type: 'application/pdf' })
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Actions above the receipt. Hidden when printing, so the PDF is just the receipt. */
export function ReceiptToolbar({
  orderId,
  receiptNumber,
  whatsappText,
  whatsappNumber,
}: {
  orderId: string
  receiptNumber: string
  whatsappText: string
  /** Customer's number in wa.me format, or null to let the user pick a chat. */
  whatsappNumber: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const whatsappHref = `https://wa.me/${whatsappNumber ?? ''}?text=${encodeURIComponent(whatsappText)}`
  const fileName = `Receipt ${receiptNumber}.pdf`

  // Phones (iPhone especially) only open the share menu right after a tap, and
  // building the PDF can take longer than that allows. So it's prepared in the
  // background as soon as the receipt is on screen, and the tap just shares it.
  const prepared = useRef<Promise<File> | null>(null)
  useEffect(() => {
    const start = () => {
      prepared.current = buildReceiptPdf(fileName)
      prepared.current.catch(() => (prepared.current = null)) // retried on tap
    }
    const timer = setTimeout(() => void document.fonts.ready.then(start), 300)
    return () => clearTimeout(timer)
  }, [fileName])

  async function sendPdf() {
    setBusy(true)
    setNote(null)
    try {
      const file = await (prepared.current ?? (prepared.current = buildReceiptPdf(fileName)))
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Receipt ${receiptNumber}` })
        } catch (err) {
          const name = (err as Error).name
          if (name === 'NotAllowedError') {
            // The PDF took longer than the tap allows; it's ready now, so a second tap works.
            setNote({ ok: true, text: 'PDF is ready. Tap Send receipt PDF again.' })
          } else if (name !== 'AbortError') {
            throw err // AbortError = closed the share menu
          }
        }
      } else {
        // Most computers can't share files: save it so it can be attached in WhatsApp.
        download(file)
        setNote({ ok: true, text: 'PDF saved to your downloads. Attach it in WhatsApp with the 📎 button.' })
      }
    } catch {
      prepared.current = null
      setNote({ ok: false, text: 'Couldn’t create the PDF. Try Print → Save as PDF instead.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 print:hidden">
      <Link href={`/orders/${orderId}`} className="text-sm text-ink-muted">
        ← Back to order
      </Link>
      <Button type="button" size="lg" onClick={sendPdf} disabled={busy}>
        {busy ? 'Preparing PDF…' : 'Send receipt PDF'}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => window.print()}>
          Print
        </Button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-pill border border-ink/10 bg-base-soft px-4 text-sm font-medium text-ink hover:bg-amber-soft"
        >
          Send as text
        </a>
      </div>
      {note ? (
        <p role={note.ok ? 'status' : 'alert'} className={note.ok ? 'text-xs text-sage-dark' : 'text-xs text-clay-dark'}>
          {note.text}
        </p>
      ) : (
        <p className="text-xs text-ink-muted">
          Send receipt PDF opens your phone&apos;s share menu: choose WhatsApp, then the customer&apos;s chat.
          {whatsappNumber ? ' Send as text opens their chat directly.' : ''}
        </p>
      )}
    </div>
  )
}
