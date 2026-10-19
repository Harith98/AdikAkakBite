'use client'

import { useState } from 'react'
import { formatMoney } from '@/lib/constants'
import { formatDateShort, formatTime12 } from '@/lib/time'
import { parseWhatsAppOrder, WHATSAPP_ORDER_TEMPLATE, type ParsedWhatsAppOrder } from '@/lib/whatsapp-order'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { OrderForm, type CustomerOption, type OrderPrefill, type ProductOption } from './OrderForm'

interface Props {
  products: ProductOption[]
  customers: CustomerOption[]
  currency: string
  /** Today in the business's timezone (YYYY-MM-DD), for reading "esok", "Sabtu" and so on. */
  today: string
}

function toPrefill(parsed: ParsedWhatsAppOrder): OrderPrefill {
  return {
    customerName: parsed.customerName ?? '',
    customerPhone: parsed.phone ?? '',
    requiredDate: parsed.requiredDate ?? '',
    requiredTime: parsed.requiredTime ?? '',
    notes: parsed.notes ?? '',
    items: parsed.items.map((i) => ({
      productId: i.productId ?? '',
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }
}

/** New order page body: a "Paste from WhatsApp" box that fills the order form below it. */
export function NewOrderPanel({ products, customers, currency, today }: Props) {
  const [message, setMessage] = useState('')
  const [parsed, setParsed] = useState<ParsedWhatsAppOrder | null>(null)
  const [notRecognised, setNotRecognised] = useState(false)
  const [prefill, setPrefill] = useState<OrderPrefill | undefined>(undefined)
  const [formVersion, setFormVersion] = useState(0) // remounts the form with the new values
  const [copied, setCopied] = useState(false)

  function fillIn() {
    const result = parseWhatsAppOrder(message, products, today)
    if (!result.recognised) {
      setNotRecognised(true)
      setParsed(null)
      return
    }
    setNotRecognised(false)
    setParsed(result)
    setPrefill(toPrefill(result))
    setFormVersion((v) => v + 1)
  }

  function clear() {
    setMessage('')
    setParsed(null)
    setNotRecognised(false)
    setPrefill(undefined)
    setFormVersion((v) => v + 1)
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(WHATSAPP_ORDER_TEMPLATE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy the template:', WHATSAPP_ORDER_TEMPLATE)
    }
  }

  const matched = parsed?.items.filter((i) => i.match === 'matched') ?? []

  return (
    <>
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Paste from WhatsApp</p>
        <p className="mt-1 text-sm text-ink-muted">
          Paste the customer&apos;s filled-in order template and the form below fills itself. Check it, then save.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder={'📌 Nama: …\n📅 Tarikh: …\n🎂 Order: …'}
          aria-label="WhatsApp order message"
          className="mt-3 w-full rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button type="button" onClick={fillIn} disabled={!message.trim()}>
            Fill in order
          </Button>
          {parsed || message ? (
            <Button type="button" variant="secondary" onClick={clear}>
              Clear
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={copyTemplate}>
              {copied ? 'Copied ✓' : 'Copy blank template'}
            </Button>
          )}
        </div>

        {notRecognised && (
          <p role="alert" className="mt-3 text-sm text-clay-dark">
            This doesn&apos;t look like the order template (no “Nama:”, “Tarikh:” or “Order:” found). Fill in the form
            below instead, or send the customer the template.
          </p>
        )}

        {parsed && (
          <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-4 text-sm" aria-live="polite">
            <ul className="flex flex-col gap-1 text-ink">
              {parsed.customerName && (
                <li>
                  ✓ {parsed.customerName}
                  {parsed.phone && <span className="text-ink-muted"> · {parsed.phone}</span>}
                </li>
              )}
              {parsed.requiredDate && (
                <li>
                  ✓ Needed {formatDateShort(parsed.requiredDate)}
                  {parsed.requiredTime && `, ${formatTime12(parsed.requiredTime)}`}
                  {parsed.dateText && <span className="text-ink-muted"> (“{parsed.dateText}”)</span>}
                </li>
              )}
              {matched.map((item, index) => (
                <li key={`${item.productId}-${index}`}>
                  ✓ {item.quantity} × {item.productName}
                  {item.unitPrice !== null && <span className="text-ink-muted"> · {formatMoney(item.unitPrice * item.quantity, currency)}</span>}
                </li>
              ))}
              {parsed.fulfilment && (
                <li>
                  ✓ {parsed.fulfilment === 'cod' ? 'COD' : 'Pickup'}
                  {parsed.address && <span className="text-ink-muted"> · {parsed.address}</span>}
                </li>
              )}
            </ul>
            {parsed.warnings.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-card bg-amber-soft p-3 text-amber-dark">
                {parsed.warnings.map((warning) => (
                  <li key={warning}>⚠ {warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card>
        <OrderForm key={formVersion} products={products} customers={customers} currency={currency} prefill={prefill} />
      </Card>

      <p className="text-xs text-ink-muted">
        Tip: send customers the blank template (Copy blank template) so their orders paste in cleanly.{' '}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(WHATSAPP_ORDER_TEMPLATE)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-raspberry-dark"
        >
          Share it on WhatsApp
        </a>
      </p>
    </>
  )
}
