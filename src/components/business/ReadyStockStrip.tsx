import Link from 'next/link'
import { productThumbUrl } from '@/lib/product-images'
import clsx from '@/lib/clsx'
import type { ReadyStockItem } from '@/lib/services/products'
import { Card } from '@/components/ui/Card'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { ReadyStockStepper } from './ReadyStockStepper'

/**
 * Today's "Ready stock": a swipeable row of photo cards, each with − count +.
 * Tap the photo or name to open the product.
 */
export function ReadyStockStrip({ items }: { items: ReadyStockItem[] }) {
  if (items.length === 0) return null
  const inStock = items.filter((i) => i.readyStock > 0)
  const units = inStock.reduce((sum, i) => sum + i.readyStock, 0)

  return (
    <Card className="!px-0 pb-4">
      <div className="flex items-baseline justify-between gap-3 px-5">
        <SectionLabel icon="🧁">Ready stock</SectionLabel>
        <p className="text-sm text-ink-muted">
          <span className="font-display text-lg text-ink">{units}</span> ready
          {items.length > inStock.length && <span className="text-clay-dark"> · {items.length - inStock.length} sold out</span>}
        </p>
      </div>

      <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const available = item.readyStock > 0
          return (
            <li key={item.id} className="flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-card border border-ink/10 bg-base-card">
              <Link href={`/business/products/${item.id}`} className="block">
                <span className="relative block aspect-[4/3] w-full bg-base-soft">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productThumbUrl(item.imageUrl) ?? ''}
                      alt=""
                      loading="lazy"
                      className={clsx('h-full w-full object-cover', !available && 'opacity-50 grayscale')}
                    />
                  ) : (
                    <span aria-hidden="true" className={clsx('flex h-full w-full items-center justify-center text-4xl', !available && 'opacity-40')}>
                      🧁
                    </span>
                  )}
                  {!available && (
                    <span className="absolute left-2 top-2 rounded-pill bg-clay px-2 py-0.5 text-[11px] font-medium text-white">Sold out</span>
                  )}
                </span>
                <span className="block px-3 pt-2">
                  <span className="line-clamp-2 block text-sm font-medium leading-snug text-ink">{item.name}</span>
                  <span className="block truncate text-xs text-ink-muted">{item.category ?? ' '}</span>
                </span>
              </Link>
              <div className="mt-auto flex justify-center px-2 pb-2 pt-1">
                <ReadyStockStepper key={`${item.id}-${item.readyStock}`} productId={item.id} productName={item.name} initialStock={item.readyStock} />
              </div>
            </li>
          )
        })}
        <li className="flex w-28 shrink-0 snap-start">
          <Link
            href="/business/products"
            className="flex w-full flex-col items-center justify-center gap-1 rounded-card border border-dashed border-ink/15 text-sm font-medium text-raspberry-dark"
          >
            <span aria-hidden="true" className="text-xl">
              →
            </span>
            All products
          </Link>
        </li>
      </ul>
    </Card>
  )
}
