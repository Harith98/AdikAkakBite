import Link from 'next/link'
import { productThumbUrl } from '@/lib/product-images'
import clsx from '@/lib/clsx'
import { readyStockLabel } from '@/lib/calc/products'
import type { ReadyStockItem } from '@/lib/services/products'
import { Card } from '@/components/ui/Card'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { ReadyStockStepper } from './ReadyStockStepper'

interface Props {
  items: ReadyStockItem[]
  title?: string
  /** Show only this many, with a link to the rest. */
  limit?: number
  /** Two columns on wider screens (for full-width pages, not side columns). */
  wide?: boolean
}

/** What's baked and ready to sell right now. One row per product: tap the name to open it, or − / + to adjust. */
export function ReadyStockList({ items, title = 'Ready stock', limit, wide = false }: Props) {
  if (items.length === 0) return null
  const inStock = items.filter((i) => i.readyStock > 0)
  const units = inStock.reduce((sum, i) => sum + i.readyStock, 0)
  const shown = limit ? items.slice(0, limit) : items

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel icon="🧁">{title}</SectionLabel>
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
            <li
              key={item.id}
              className={clsx(
                'flex items-center gap-2 rounded-card border py-2 pl-3 pr-2',
                available ? 'border-ink/10 bg-base-card' : 'border-ink/5 bg-base-soft/60'
              )}
            >
              <Link href={`/business/products/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productThumbUrl(item.imageUrl) ?? ''}
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
                  {!available && <span className="block text-xs font-medium text-clay-dark">{readyStockLabel(item.readyStock)}</span>}
                </span>
              </Link>
              {/* key: start again from the server's number after a refresh */}
              <ReadyStockStepper
                key={`${item.id}-${item.readyStock}`}
                productId={item.id}
                productName={item.name}
                initialStock={item.readyStock}
              />
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
