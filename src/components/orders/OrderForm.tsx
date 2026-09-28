'use client'

import { useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { calculateOrderTotals } from '@/lib/calc/orders'
import { formatMoney } from '@/lib/constants'
import { saveOrder, type SaveOrderState } from '@/app/(app)/orders/actions'
import type { OrderView } from '@/lib/services/orders'

export interface ProductOption {
  id: string
  name: string
  price: number
}
export interface CustomerOption {
  name: string
  phone: string | null
}

interface ItemState {
  key: number
  productId: string
  productName: string
  quantity: string
  unitPrice: string
}

const initialState: SaveOrderState = { error: null, nonce: 0 }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'
const toNumber = (value: string) => Number(value.replace(/[,\s]/g, '')) || 0

export function OrderForm({
  products,
  customers,
  currency,
  order,
}: {
  products: ProductOption[]
  customers: CustomerOption[]
  currency: string
  order?: OrderView
}) {
  const [state, formAction] = useFormState(saveOrder, initialState)
  const nextKey = useRef(1)
  const [items, setItems] = useState<ItemState[]>(() =>
    order && order.items.length > 0
      ? order.items.map((i) => ({
          key: nextKey.current++,
          productId: i.productId ?? '',
          productName: i.productName,
          quantity: String(i.quantity),
          unitPrice: String(i.unitPrice),
        }))
      : [{ key: nextKey.current++, productId: '', productName: '', quantity: '1', unitPrice: '' }]
  )
  const [customerName, setCustomerName] = useState(order?.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discount, setDiscount] = useState(order && order.discount > 0 ? String(order.discount) : '')
  const [deliveryFee, setDeliveryFee] = useState(order && order.deliveryFee > 0 ? String(order.deliveryFee) : '')
  const [deposit, setDeposit] = useState(order && order.deposit > 0 ? String(order.deposit) : '')
  const [paidInFull, setPaidInFull] = useState(order?.paymentStatus === 'fully_paid')

  const update = (key: number, patch: Partial<ItemState>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  function chooseProduct(key: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (product) update(key, { productId, productName: product.name, unitPrice: String(product.price) })
    else update(key, { productId: '' })
  }

  function onCustomerChange(value: string) {
    setCustomerName(value)
    const match = customers.find((c) => c.name.toLowerCase() === value.trim().toLowerCase())
    if (match?.phone && !customerPhone) setCustomerPhone(match.phone)
  }

  const totals = calculateOrderTotals({
    items: items.map((i) => ({ quantity: toNumber(i.quantity), unitPrice: toNumber(i.unitPrice) })),
    discount: toNumber(discount),
    deliveryFee: toNumber(deliveryFee),
    deposit: paidInFull ? Number.MAX_SAFE_INTEGER : toNumber(deposit),
  })

  const itemsJson = JSON.stringify(
    items.map((i) => ({
      productId: i.productId || null,
      productName: i.productName,
      quantity: Number(i.quantity),
      unitPrice: i.unitPrice,
    }))
  )

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {order && <input type="hidden" name="orderId" value={order.id} />}
      <input type="hidden" name="items" value={itemsJson} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-ink">Customer</legend>
        <input
          name="customerName"
          list="customer-names"
          required
          maxLength={120}
          value={customerName}
          onChange={(e) => onCustomerChange(e.target.value)}
          placeholder="Name (or “Walk-in”)"
          aria-label="Customer name"
          className={input}
          autoComplete="off"
        />
        <datalist id="customer-names">
          {customers.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
        <input
          name="customerPhone"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="Phone (optional)"
          aria-label="Customer phone"
          inputMode="tel"
          maxLength={30}
          className={input}
        />
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">Items</legend>
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={item.key} className="flex flex-col gap-2 rounded-card border border-ink/10 p-3">
              <select
                value={item.productId}
                onChange={(e) => chooseProduct(item.key, e.target.value)}
                aria-label={`Item ${index + 1} product`}
                className={input}
              >
                <option value="">Custom item</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.price, currency)}
                  </option>
                ))}
              </select>
              {item.productId === '' && (
                <input
                  value={item.productName}
                  onChange={(e) => update(item.key, { productName: e.target.value })}
                  placeholder="Item name"
                  aria-label={`Item ${index + 1} name`}
                  maxLength={120}
                  className={input}
                />
              )}
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-ink-muted">
                  Qty
                  <input
                    value={item.quantity}
                    onChange={(e) => update(item.key, { quantity: e.target.value })}
                    inputMode="numeric"
                    className={input}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-muted">
                  Price each
                  <input
                    value={item.unitPrice}
                    onChange={(e) => update(item.key, { unitPrice: e.target.value })}
                    inputMode="decimal"
                    className={input}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={items.length === 1}
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full"
          onClick={() =>
            setItems((prev) => [...prev, { key: nextKey.current++, productId: '', productName: '', quantity: '1', unitPrice: '' }])
          }
        >
          + Add another item
        </Button>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">When is it needed?</legend>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" name="requiredDate" defaultValue={order?.requiredDate ?? ''} aria-label="Required date" className={input} />
          <input type="time" name="requiredTime" defaultValue={order?.requiredTime?.slice(0, 5) ?? ''} aria-label="Required time" className={input} />
        </div>
        <p className="mt-1 text-xs text-ink-muted">Add a date and time so it shows up on Today when it&apos;s due.</p>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Money</legend>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Discount
          <input name="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Delivery fee
          <input name="deliveryFee" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} inputMode="decimal" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Deposit paid
          <input
            name="deposit"
            value={paidInFull ? String(totals.total) : deposit}
            onChange={(e) => setDeposit(e.target.value)}
            disabled={paidInFull}
            inputMode="decimal"
            className={input}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink">
          <input type="checkbox" name="paidInFull" checked={paidInFull} onChange={(e) => setPaidInFull(e.target.checked)} className="h-4 w-4" />
          Paid in full
        </label>
      </fieldset>

      <div className="rounded-card bg-base-soft p-4 text-sm">
        <div className="flex justify-between text-ink-muted"><span>Items</span><span>{formatMoney(totals.subtotal, currency)}</span></div>
        {totals.discount > 0 && <div className="flex justify-between text-ink-muted"><span>Discount</span><span>− {formatMoney(totals.discount, currency)}</span></div>}
        {totals.deliveryFee > 0 && <div className="flex justify-between text-ink-muted"><span>Delivery</span><span>{formatMoney(totals.deliveryFee, currency)}</span></div>}
        <div className="mt-1 flex justify-between text-base font-medium text-ink"><span>Total</span><span>{formatMoney(totals.total, currency)}</span></div>
        <div className="flex justify-between text-ink-muted"><span>Still to pay</span><span>{formatMoney(totals.balance, currency)}</span></div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Notes</span>
        <textarea name="notes" rows={3} maxLength={500} defaultValue={order?.notes ?? ''} className="rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry" />
      </label>

      {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
      {state.nonce !== 0 && !state.error && <p className="text-sm text-sage-dark">Saved.</p>}
      <SubmitButton label={order ? 'Save changes' : 'Create order'} />
    </form>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Saving…' : label}
    </Button>
  )
}
