import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getCustomerMetrics, type CustomerView } from '@/lib/services/customers'
import { getBusinessNow } from '@/lib/time'
import { formatMoney } from '@/lib/constants'
import { normalizePhone } from '@/lib/customer-identity'
import { toWhatsAppNumber } from '@/lib/receipts'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProductSearchBox } from '@/components/business/ProductSearchBox'

/** Days without an order before a past customer counts as "quiet". */
const QUIET_DAYS = 30

const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'regulars', label: '⭐ Regulars' },
  { key: 'ordering', label: '🧁 Ordering now' },
  { key: 'quiet', label: `💤 Quiet ${QUIET_DAYS}d+` },
] as const
type View = (typeof VIEWS)[number]['key']

/** A soft colour per customer, always the same for the same name. */
const AVATAR_TONES = [
  'bg-raspberry-soft text-raspberry-dark',
  'bg-amber-soft text-amber-dark',
  'bg-sage-soft text-sage-dark',
  'bg-clay-soft text-clay-dark',
  'bg-[#EDE7F6] text-[#5E4B8B]',
  'bg-[#E3EEF7] text-[#3C5A78]',
]
function toneFor(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]!
}

const isQuiet = (c: CustomerView) => c.numberOfOrders > 0 && (c.daysSinceLastOrder ?? 0) >= QUIET_DAYS

export default async function CustomersPage({ searchParams }: { searchParams: { view?: string; q?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const today = getBusinessNow(settings.timezone).isoDate
  const customers = await getCustomerMetrics(createClient(), business.id, today)
  const money = (n: number) => formatMoney(n, settings.currency)

  const buyers = customers.filter((c) => c.numberOfOrders > 0)
  const repeat = buyers.filter((c) => c.isRepeatCustomer).length
  const topSpender = [...buyers].sort((a, b) => b.totalSpending - a.totalSpending)[0]?.customerId ?? null

  const view: View = VIEWS.some((v) => v.key === searchParams.view) ? (searchParams.view as View) : 'all'
  const query = (searchParams.q ?? '').trim().toLowerCase().slice(0, 80)
  const queryPhone = normalizePhone(query)
  const shown = [...customers]
    .filter((c) =>
      view === 'regulars' ? c.isRepeatCustomer : view === 'ordering' ? c.openOrders > 0 : view === 'quiet' ? isQuiet(c) : true
    )
    .filter((c) => {
      if (!query) return true
      if (c.name.toLowerCase().includes(query)) return true
      return Boolean(queryPhone && queryPhone.length >= 3 && normalizePhone(c.phone)?.includes(queryPhone))
    })
    // Best customers first; customers with no completed order yet go last.
    .sort((a, b) => b.totalSpending - a.totalSpending || a.name.localeCompare(b.name))
  const counts: Record<View, number> = {
    all: customers.length,
    regulars: customers.filter((c) => c.isRepeatCustomer).length,
    ordering: customers.filter((c) => c.openOrders > 0).length,
    quiet: customers.filter(isQuiet).length,
  }
  const viewHref = (key: View) => {
    const params = new URLSearchParams()
    if (key !== 'all') params.set('view', key)
    if (searchParams.q) params.set('q', searchParams.q)
    const qs = params.toString()
    return qs ? `/business/customers?${qs}` : '/business/customers'
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/business', label: 'Business' }} title="Customers" subtitle="Added automatically when you create an order." />

      {customers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat emoji="👥" label="Customers" value={String(customers.length)} tone="bg-raspberry-soft" />
          <Stat emoji="⭐" label="Regulars" value={String(repeat)} tone="bg-amber-soft" />
          <Stat
            emoji="🔁"
            label="Come back"
            value={buyers.length > 0 ? `${Math.round((repeat / buyers.length) * 100)}%` : '—'}
            tone="bg-sage-soft"
          />
        </div>
      )}

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            emoji="👥"
            title="No customers yet"
            text="Create your first order and they'll appear here, with what they buy and how often."
            action={{ href: '/orders/new', label: 'Create an order' }}
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <ProductSearchBox initial={searchParams.q ?? ''} placeholder="Search by name or phone" />
            <nav aria-label="Filter customers" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {VIEWS.map((v) => {
                const on = view === v.key
                return (
                  <Link
                    key={v.key}
                    href={viewHref(v.key)}
                    scroll={false}
                    aria-current={on ? 'page' : undefined}
                    className={clsx(
                      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-2 text-sm font-medium',
                      on ? 'bg-raspberry text-white shadow-card' : 'bg-base-card text-ink-muted shadow-card'
                    )}
                  >
                    {v.label}
                    <span className={clsx('rounded-pill px-1.5 text-xs', on ? 'bg-white/25' : 'bg-ink/5')}>{counts[v.key]}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {shown.length === 0 ? (
            <Card>
              <EmptyState compact emoji="🔍" title="No one matches" text="Try another name, number or filter." />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((c) => (
                <CustomerCard key={c.customerId} customer={c} money={money} isTop={c.customerId === topSpender} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function CustomerCard({ customer: c, money, isTop }: { customer: CustomerView; money: (n: number) => string; isTop: boolean }) {
  const whatsapp = toWhatsAppNumber(c.phone)
  const last =
    c.numberOfOrders === 0
      ? c.openOrders > 0
        ? 'First order on the way'
        : 'No orders yet'
      : `${c.numberOfOrders} order${c.numberOfOrders === 1 ? '' : 's'} · last ${c.daysSinceLastOrder === 0 ? 'today' : `${c.daysSinceLastOrder} day${c.daysSinceLastOrder === 1 ? '' : 's'} ago`}`

  return (
    <li className="flex items-center gap-2 rounded-card border border-raspberry/15 bg-base-card p-3 shadow-card">
      <Link href={`/business/customers/${c.customerId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-pill font-display text-xl', toneFor(c.name))}
        >
          {(c.name.trim().charAt(0) || '?').toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-display text-lg leading-tight text-ink">{c.name}</span>
            {isTop && <Tag className="bg-amber-soft text-amber-dark">🏆 Top</Tag>}
            {c.isRepeatCustomer && <Tag className="bg-sage-soft text-sage-dark">⭐ Regular</Tag>}
            {c.openOrders > 0 && <Tag className="bg-raspberry-soft text-raspberry-dark">🧁 Ordering</Tag>}
            {isQuiet(c) && <Tag className="bg-ink/5 text-ink-muted">💤 Quiet</Tag>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">
            {c.phone ? `${c.phone} · ` : ''}
            {last}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-lg leading-tight text-ink">{money(c.totalSpending)}</span>
          <span className="block text-[11px] text-ink-faint">spent</span>
        </span>
      </Link>
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${c.name}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-[#25D366] text-white shadow-card transition-transform active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
          </svg>
        </a>
      )}
    </li>
  )
}

function Tag({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={clsx('rounded-pill px-1.5 py-0.5 text-[10px] font-medium leading-none', className)}>{children}</span>
}

function Stat({ emoji, label, value, tone }: { emoji: string; label: string; value: string; tone: string }) {
  return (
    <div className={clsx('rounded-card p-3 shadow-card', tone)}>
      <span className="flex items-center justify-between">
        <span aria-hidden="true" className="text-base">
          {emoji}
        </span>
        <span className="font-display text-2xl leading-none text-ink">{value}</span>
      </span>
      <p className="mt-1.5 text-[11px] text-ink-muted">{label}</p>
    </div>
  )
}
