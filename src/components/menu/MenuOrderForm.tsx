'use client'

import { useState } from 'react'
import clsx from '@/lib/clsx'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { getBusinessNow } from '@/lib/time'
import { buildWhatsAppOrderMessage } from '@/lib/whatsapp-order'
import { isValidPhoneKey, normalizePhone } from '@/lib/customer-identity'

const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm text-ink outline-none focus:border-raspberry'

/**
 * The shop's order template as a form. "Send on WhatsApp" opens WhatsApp to the
 * business with the filled-in template, which the owner pastes into
 * Orders → New order → Paste from WhatsApp. Nothing is saved on the server.
 */
export function MenuOrderForm({ whatsappNumber }: { whatsappNumber: string | null }) {
  const today = getBusinessNow(DEFAULT_TIMEZONE).isoDate
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [order, setOrder] = useState('')
  const [phone, setPhone] = useState('')
  const [fulfilment, setFulfilment] = useState<'pickup' | 'cod'>('pickup')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  function send() {
    const missing = [
      !name.trim() && 'name',
      !date && 'date',
      !order.trim() && 'what you’d like to order',
      !phone.trim() && 'phone number',
      fulfilment === 'cod' && !address.trim() && 'COD address',
    ].filter(Boolean)
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(', ')}.`)
      return
    }
    const key = normalizePhone(phone)
    if (!key || !isValidPhoneKey(key)) {
      setError('Please check the phone number, e.g. 012-345 6789.')
      return
    }
    if (date < today) {
      setError('Please pick today or a later date.')
      return
    }
    if (!whatsappNumber) return
    setError(null)
    const message = buildWhatsAppOrderMessage({ name, date, time, order, phone, fulfilment, address })
    window.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
  }

  return (
    <div className="mt-3 flex flex-col gap-4">
      <Field label="📌 Nama">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={input} />
      </Field>

      <Field label="📅 Tarikh" hint={date === today ? 'Same-day orders depend on slots and stock. We’ll confirm on WhatsApp.' : undefined}>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={input} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (optional)" className={input} />
        </div>
        <span className="mt-1 block text-xs text-ink-faint">Time is optional.</span>
      </Field>

      <Field label="🎂 Order" hint="From the menu, one item per line, with how many.">
        <textarea
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={'e.g.\n1 Batik Cake Indulgence Chocolate 8″\n2 Bento Brownies Klasik'}
          className="w-full rounded-card border border-ink/15 bg-base p-3 text-sm text-ink outline-none focus:border-raspberry"
        />
      </Field>

      <Field label="📲 Phone No">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={30} placeholder="012-345 6789" className={input} />
      </Field>

      <Field label="🚗 Pickup / COD">
        <div className="grid grid-cols-2 gap-1 rounded-pill bg-ink/5 p-1">
          {(['pickup', 'cod'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFulfilment(option)}
              aria-pressed={fulfilment === option}
              className={clsx(
                'h-10 rounded-pill text-sm font-medium transition-colors',
                fulfilment === option ? 'bg-base-card text-ink shadow-card' : 'text-ink-muted'
              )}
            >
              {option === 'pickup' ? 'Pickup' : 'COD'}
            </button>
          ))}
        </div>
      </Field>

      {fulfilment === 'cod' && (
        <Field label="📍 Alamat">
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            maxLength={300}
            autoComplete="street-address"
            className="w-full rounded-card border border-ink/15 bg-base p-3 text-sm text-ink outline-none focus:border-raspberry"
          />
        </Field>
      )}

      {error && (
        <p role="alert" className="text-sm text-clay-dark">
          {error}
        </p>
      )}

      {whatsappNumber ? (
        <button
          type="button"
          onClick={send}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-[#25D366] text-base font-medium text-white transition-opacity hover:opacity-90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
          </svg>
          Send order on WhatsApp
        </button>
      ) : (
        <p className="rounded-card bg-amber-soft p-3 text-sm text-amber-dark">Online ordering isn’t set up yet. Please message us directly.</p>
      )}
      <p className="text-center text-xs text-ink-muted">Opens WhatsApp with your order written out. Just press send.</p>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  )
}
