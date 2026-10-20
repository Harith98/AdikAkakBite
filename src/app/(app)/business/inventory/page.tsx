import Link from 'next/link'
import clsx from '@/lib/clsx'
import { needsReorder, type InventoryStatusValue } from '@/lib/calc/inventory'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getInventoryItems, type InventoryItemView } from '@/lib/services/inventory'
import { formatMoney } from '@/lib/constants'
import { ingredientEmoji, shoppingListMessage, STATUS_ORDER, stockFill, suggestedBuy } from '@/lib/inventory-ui'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LinkButton } from '@/components/ui/LinkButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { InventoryStatusBadge } from '@/components/business/InventoryStatusBadge'
import { ProductSearchBox } from '@/components/business/ProductSearchBox'

const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'buy', label: '🛒 To buy' },
  { key: 'low', label: '🟡 Low' },
  { key: 'ok', label: '🟢 OK' },
] as const
type View = (typeof VIEWS)[number]['key']

const matches = (view: View, status: InventoryStatusValue) =>
  view === 'all' ? true : view === 'buy' ? needsReorder(status) : view === 'low' ? status === 'low' : status === 'ok'

/** Bar colour by status. */
const BAR: Record<InventoryStatusValue, string> = {
  ok: 'bg-sage',
  low: 'bg-amber',
  reorder: 'bg-clay',
  out_of_stock: 'bg-clay',
}

const num = (n: number) => String(Math.round(Number(n) * 1000) / 1000)

export default async function InventoryPage({ searchParams }: { searchParams: { view?: string; q?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const items = await getInventoryItems(createClient(), business.id)
  const money = (n: number) => formatMoney(n, settings.currency)

  const toBuy = items.filter((i) => needsReorder(i.status)).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  const stockValue = items.reduce((sum, i) => sum + Math.max(0, Number(i.current_quantity)) * Number(i.unit_cost), 0)

  const view: View = VIEWS.some((v) => v.key === searchParams.view) ? (searchParams.view as View) : 'all'
  const query = (searchParams.q ?? '').trim().toLowerCase().slice(0, 80)
  const shown = items
    .filter((i) => matches(view, i.status))
    .filter((i) => !query || i.name.toLowerCase().includes(query) || (i.category ?? '').toLowerCase().includes(query))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name))
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, items.filter((i) => matches(v.key, i.status)).length])) as Record<View, number>
  const viewHref = (key: View) => {
    const params = new URLSearchParams()
    if (key !== 'all') params.set('view', key)
    if (searchParams.q) params.set('q', searchParams.q)
    const qs = params.toString()
    return qs ? `/business/inventory?${qs}` : '/business/inventory'
  }
  const shoppingText = shoppingListMessage(
    toBuy.map((i) => ({ name: i.name, unit: i.unit, quantity: Number(i.current_quantity), reorderLevel: Number(i.reorder_level) })),
    business.name
  )

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        back={{ href: '/business', label: 'Business' }}
        title="Inventory"
        subtitle="Ingredients and packaging"
        action={<LinkButton href="/business/inventory/new">Add item</LinkButton>}
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            emoji="📦"
            title="No ingredients yet"
            text="Add your ingredients and packaging with a reorder level, and you'll be told before anything runs low."
            action={{ href: '/business/inventory/new', label: 'Add an item' }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat emoji="📦" label="Items" value={String(items.length)} tone="bg-sage-soft" />
            <Stat
              emoji="🛒"
              label="To buy"
              value={String(toBuy.length)}
              tone={toBuy.length > 0 ? 'bg-clay-soft ring-1 ring-clay/30' : 'bg-base-card'}
              alert={toBuy.length > 0}
            />
            <Stat emoji="💰" label="Stock value" value={money(stockValue)} tone="bg-amber-soft" small />
          </div>

          {toBuy.length > 0 && (
            <Card className="!border-clay/30 !bg-clay-soft/40">
              <div className="flex items-baseline justify-between gap-3">
                <SectionLabel icon="🛒">Shopping list</SectionLabel>
                <span className="text-xs text-ink-muted">enough for ~2× reorder level</span>
              </div>
              <ul className="mt-3 flex flex-col divide-y divide-clay/10">
                {toBuy.map((i) => {
                  const amount = suggestedBuy(Number(i.current_quantity), Number(i.reorder_level))
                  return (
                    <li key={i.id}>
                      <Link href={`/business/inventory/${i.id}`} className="flex items-center gap-3 py-2">
                        <span aria-hidden="true" className="text-xl">
                          {ingredientEmoji(i.name, i.category)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{i.name}</span>
                          <span className={clsx('block text-xs', i.status === 'out_of_stock' ? 'font-medium text-clay-dark' : 'text-ink-muted')}>
                            {i.status === 'out_of_stock' ? 'Out of stock' : `${num(Number(i.current_quantity))} ${i.unit} left`}
                          </span>
                        </span>
                        {amount > 0 && (
                          <span className="shrink-0 rounded-pill bg-white px-2.5 py-1 text-xs font-semibold text-clay-dark shadow-card">
                            Buy {num(amount)} {i.unit}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shoppingText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-[#25D366] text-sm font-semibold text-white shadow-card transition-transform active:scale-[0.98]"
              >
                Send list on WhatsApp
              </a>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            <ProductSearchBox initial={searchParams.q ?? ''} placeholder="Search ingredients" />
            <nav aria-label="Filter inventory" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              <EmptyState compact emoji="🔍" title="Nothing matches" text="Try another name or filter." />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {shown.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function ItemCard({ item }: { item: InventoryItemView }) {
  const quantity = Number(item.current_quantity)
  const reorder = Number(item.reorder_level)
  const fill = stockFill(quantity, reorder)
  const alert = needsReorder(item.status)
  return (
    <li>
      <Link
        href={`/business/inventory/${item.id}`}
        className={clsx(
          'flex h-full flex-col gap-3 rounded-card border bg-base-card p-4 shadow-card transition-transform active:scale-[0.99]',
          alert ? 'border-clay/40' : 'border-raspberry/15'
        )}
      >
        <span className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-card text-2xl', alert ? 'bg-clay-soft' : 'bg-base-soft')}
          >
            {ingredientEmoji(item.name, item.category)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-lg leading-tight text-ink">{item.name}</span>
            {item.category && <span className="block truncate text-xs text-ink-muted">{item.category}</span>}
          </span>
          <InventoryStatusBadge status={item.status} />
        </span>

        <span>
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-display text-xl text-ink">
              {num(quantity)} <span className="font-body text-sm text-ink-muted">{item.unit}</span>
            </span>
            <span className="text-xs text-ink-faint">reorder at {num(reorder)}</span>
          </span>
          {/* Stock bar: the tick marks the reorder level (halfway). */}
          <span className="relative mt-1.5 block h-2 overflow-hidden rounded-pill bg-ink/10" role="img" aria-label={`${fill}% of a comfortable stock level`}>
            <span className={clsx('block h-full rounded-pill transition-[width]', BAR[item.status])} style={{ width: `${Math.max(fill, quantity > 0 ? 3 : 0)}%` }} />
            {reorder > 0 && <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 bg-white/90" />}
          </span>
        </span>
      </Link>
    </li>
  )
}

function Stat({ emoji, label, value, tone, alert, small }: { emoji: string; label: string; value: string; tone: string; alert?: boolean; small?: boolean }) {
  return (
    <div className={clsx('rounded-card p-3 shadow-card', tone)}>
      <span className="flex items-center justify-between gap-1">
        <span aria-hidden="true" className="text-base">
          {emoji}
        </span>
        <span className={clsx('font-display leading-none', small ? 'text-base' : 'text-2xl', alert ? 'text-clay-dark' : 'text-ink')}>{value}</span>
      </span>
      <p className={clsx('mt-1.5 text-[11px]', alert ? 'font-medium text-clay-dark' : 'text-ink-muted')}>{label}</p>
    </div>
  )
}
