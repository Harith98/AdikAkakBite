import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getOrder } from '@/lib/services/orders'
import { formatMoney } from '@/lib/constants'
import { buildReceiptText, formatReceiptNumber, PAYMENT_METHOD_LABELS, RECEIPT_ELEMENT_ID, toWhatsAppNumber } from '@/lib/receipts'
import { formatDateShort } from '@/lib/time'
import { UUID_PATTERN } from '@/lib/validation/common'
import { ReceiptToolbar } from '@/components/orders/ReceiptToolbar'

export const metadata: Metadata = { title: 'Receipt', robots: { index: false } }

const DEFAULT_FOOTER = 'Thank you for your order!'

/**
 * Standalone (no app navigation) so it prints / saves to PDF as just the
 * receipt. Lives outside the (app) route group for that reason; auth and
 * business scoping still come from getCurrentBusinessContext + RLS.
 */
export default async function ReceiptPage({ params }: { params: { orderId: string } }) {
  if (!UUID_PATTERN.test(params.orderId)) notFound()
  const { business, settings } = await getCurrentBusinessContext()
  const order = await getOrder(createClient(), business.id, params.orderId)
  if (!order) notFound()

  if (order.status !== 'completed' || order.receiptNumber === null) {
    return (
      <Shell>
        <p className="font-medium text-ink">No receipt to show</p>
        <p className="mt-1 text-sm text-ink-muted">
          {order.status !== 'completed'
            ? 'This order isn’t completed. Receipts are only shown for completed orders.'
            : 'A receipt hasn’t been generated for this order yet.'}
        </p>
        <Link href={`/orders/${order.id}`} className="mt-4 inline-block text-sm font-medium text-raspberry-dark">
          ← Back to order
        </Link>
      </Shell>
    )
  }

  const money = (n: number) => formatMoney(n, settings.currency)
  const receiptNo = formatReceiptNumber(order.receiptNumber)
  const issuedAt = new Date(order.receiptIssuedAt ?? Date.now())
  const issuedLabel = issuedAt.toLocaleString('en-GB', {
    timeZone: settings.timezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const isPaid = order.balance <= 0 && order.total > 0
  const footer = business.receipt_footer?.trim() || DEFAULT_FOOTER
  const methodLabel = order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod] : null

  const whatsappText = buildReceiptText({
    businessName: business.name,
    receiptNumber: receiptNo,
    date: issuedLabel,
    customerName: order.customerName,
    items: order.items.map((i) => ({ name: i.productName, quantity: i.quantity, amount: money(i.quantity * i.unitPrice) })),
    total: money(order.total),
    paid: `${money(order.deposit)}${methodLabel ? ` (${methodLabel})` : ''}`,
    balance: order.balance > 0 ? money(order.balance) : null,
    footer,
  })

  return (
    <Shell>
      <ReceiptToolbar
        orderId={order.id}
        receiptNumber={receiptNo}
        whatsappText={whatsappText}
        whatsappNumber={toWhatsAppNumber(order.customerPhone)}
      />

      <article id={RECEIPT_ELEMENT_ID} className="rounded-card bg-white p-6 text-ink shadow-card print:rounded-none print:p-0 print:shadow-none">
        {/* Business */}
        <header className="border-b border-dashed border-ink/20 pb-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/iconAdik192x192.png" alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
          <h1 className="font-display text-2xl">{business.name}</h1>
          {business.registration_number && <p className="text-xs text-ink-muted">Reg. No. {business.registration_number}</p>}
          {business.address && <p className="mt-1 whitespace-pre-line text-xs text-ink-muted">{business.address}</p>}
          {(business.phone || business.email) && (
            <p className="text-xs text-ink-muted">{[business.phone, business.email].filter(Boolean).join(' · ')}</p>
          )}
        </header>

        {/* Receipt meta */}
        <section className="border-b border-dashed border-ink/20 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">Receipt</h2>
            <span
              className={
                isPaid
                  ? 'rounded-pill border-2 border-sage-dark px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-sage-dark'
                  : 'rounded-pill border-2 border-clay-dark px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-clay-dark'
              }
            >
              {isPaid ? 'Paid' : 'Balance due'}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-muted">Receipt no.</dt>
            <dd className="text-right font-medium tabular-nums">{receiptNo}</dd>
            <dt className="text-ink-muted">Date</dt>
            <dd className="text-right">{issuedLabel}</dd>
            <dt className="text-ink-muted">Order date</dt>
            <dd className="text-right">{formatDateShort(order.orderDate)}</dd>
            <dt className="text-ink-muted">Order ref.</dt>
            <dd className="text-right font-mono text-xs uppercase">{order.id.slice(0, 8)}</dd>
            {order.customerName && (
              <>
                <dt className="text-ink-muted">Customer</dt>
                <dd className="text-right">
                  {order.customerName}
                  {order.customerPhone && <span className="block text-xs text-ink-muted">{order.customerPhone}</span>}
                </dd>
              </>
            )}
          </dl>
        </section>

        {/* Items */}
        <section className="border-b border-dashed border-ink/20 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-center font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Price</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1 pr-2">{item.productName}</td>
                  <td className="py-1 text-center tabular-nums">{item.quantity}</td>
                  <td className="py-1 text-right tabular-nums">{money(item.unitPrice)}</td>
                  <td className="py-1 text-right tabular-nums">{money(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="py-4 text-sm">
          <Line label="Subtotal" value={money(order.subtotal)} />
          {order.discount > 0 && <Line label="Discount" value={`− ${money(order.discount)}`} />}
          {order.deliveryFee > 0 && <Line label="Delivery" value={money(order.deliveryFee)} />}
          <div className="my-2 border-t border-ink/20" />
          <Line label="Total" value={money(order.total)} strong />
          <Line label={`Paid${methodLabel ? ` · ${methodLabel}` : ''}`} value={money(order.deposit)} />
          {order.balance > 0 && <Line label="Balance due" value={money(order.balance)} strong />}
        </section>

        {order.notes && <p className="border-t border-dashed border-ink/20 pt-3 text-xs text-ink-muted">Note: {order.notes}</p>}

        <footer className="mt-4 border-t border-dashed border-ink/20 pt-4 text-center">
          <p className="whitespace-pre-line text-sm">{footer}</p>
          <p className="mt-2 text-[10px] text-ink-muted">This is a computer-generated receipt. No signature is required.</p>
        </footer>
      </article>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base px-4 py-6 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto w-full max-w-md print:max-w-none">{children}</div>
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between py-0.5 text-base font-semibold' : 'flex justify-between py-0.5 text-ink-muted'}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
