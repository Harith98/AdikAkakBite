import Link from 'next/link'
import clsx from '@/lib/clsx'
import { readyStockLabel } from '@/lib/calc/products'
import type { ReadyStockItem } from '@/lib/services/products'
import { Card } from '@/components/ui/Card'

interface Props {
  items: ReadyStockItem[]
  title?: string
  /** Show only this many, with a link to the rest. */
  limit?: number
  /** Two columns on wider screens (for full-width pages, not side columns). */
  wide?: boolean
}

/** What's baked and ready to sell right now. One row per product; each row opens the product. */
export function ReadyStockList({ items, title = 'Ready to sell', limit, wide = false }: Props) {
  if (items.length === 0) return null
  const inStock = items.filter((i) => i.readyStock > 0)
  const units = inStock.reduce((sum, i) => sum + i.readyStock, 0)
  const shown = limit ? items.slice(0, limit) : items

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{title}</p>
        <p className="text-sm text-ink-muted">
          {units} ready
          {items.length > inStock.length && (
            <span className="text-clay-dark"> · {items.length - inStock.length} sold out</span>
          )}
        </p>
      </div>

      <ul className={clsx('mt-3 grid gap-2', wide && 'sm:grid-cols-2')}>
        {shown.map((item) => {
          const available = item.readyStock > 0
          return (
            <li key={item.id}>
              <Link
                href={`/business/products/${item.id}`}
                className={clsx(
                  'flex h-full items-center gap-3 rounded-card border px-3 py-2.5 transition-colors',
                  available ? 'border-ink/10 bg-base-card hover:border-raspberry/40 hover:bg-base-soft' : 'border-ink/5 bg-base-soft/60'
                )}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    className={clsx('h-11 w-11 shrink-0 rounded-card object-cover', !available && 'opacity-50 grayscale')}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-base-soft text-xl', !available && 'opacity-50')}
                  >
                    🧁
                  </span>
                )}
                <span className="min-w-0 flex-1 leading-snug">
                  <span className={clsx('block text-sm font-medium', available ? 'text-ink' : 'text-ink-muted')}>{item.name}</span>
                  {item.category && <span className="block text-xs text-ink-muted">{item.category}</span>}
                </span>
                {available ? (
                  <span className="shrink-0 text-right leading-none">
                    <span className="block font-display text-2xl text-ink">{item.readyStock}</span>
                    <span className="mt-0.5 block text-[11px] text-sage-dark">ready</span>
                  </span>
                ) : (
                  <span className="shrink-0 rounded-pill bg-clay-soft px-2.5 py-1 text-xs font-medium text-clay-dark">
                    {readyStockLabel(item.readyStock)}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {limit && items.length > limit && (
        <Link href="/business/products" className="mt-2 inline-block text-sm font-medium text-raspberry-dark">
          See all {items.length} →
        </Link>
      )}
    </Card>
  )
}
