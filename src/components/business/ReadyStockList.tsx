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
}

/** What's baked and ready to sell right now, at a glance. Each row opens the product. */
export function ReadyStockList({ items, title = 'Ready to sell', limit }: Props) {
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

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((item) => {
          const available = item.readyStock > 0
          return (
            <li key={item.id}>
              <Link
                href={`/business/products/${item.id}`}
                className={clsx(
                  'flex h-full items-center gap-2 rounded-card border p-2 transition-colors',
                  available ? 'border-sage/40 bg-sage-soft/40 hover:bg-sage-soft' : 'border-ink/10 bg-base-soft/60 opacity-75 hover:opacity-100'
                )}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-card object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-base-card text-lg">
                    🧁
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                  <span className={clsx('block text-xs', available ? 'text-sage-dark' : 'font-medium text-clay-dark')}>
                    {available ? 'ready' : readyStockLabel(item.readyStock)}
                  </span>
                </span>
                {available && <span className="shrink-0 font-display text-2xl text-ink">{item.readyStock}</span>}
              </Link>
            </li>
          )
        })}
      </ul>

      {limit && items.length > limit && (
        <Link href="/business/products" className="mt-3 inline-block text-sm font-medium text-raspberry-dark">
          See all {items.length} →
        </Link>
      )}
    </Card>
  )
}
