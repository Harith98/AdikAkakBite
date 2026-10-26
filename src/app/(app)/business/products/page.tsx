import { PageHeader } from '@/components/ui/PageHeader'
import { productThumbUrl } from '@/lib/product-images'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProducts, sortReadyStock, type ProductView } from '@/lib/services/products'
import { ProductSearchBox } from '@/components/business/ProductSearchBox'
import { ReadyStockList } from '@/components/business/ReadyStockList'
import { formatMoney, formatPercent } from '@/lib/constants'
import { readyStockLabel, readyStockState } from '@/lib/calc/products'
import { categoryChips, filterProducts } from '@/lib/product-filters'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LinkButton } from '@/components/ui/LinkButton'

export default async function ProductsPage({ searchParams }: { searchParams: { category?: string; q?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const products = await getProducts(createClient(), business.id)
  const money = (n: number) => formatMoney(n, settings.currency)

  const chips = categoryChips(products)
  const category = chips.some((c) => c.value === searchParams.category) ? (searchParams.category as string) : null
  const query = (searchParams.q ?? '').trim().slice(0, 80)
  const shown = filterProducts(products, { category, query })
  const isFiltered = Boolean(category || query)
  /** A link to this page that keeps the current filters, changing only what's given. */
  const pageHref = (change: { category?: string | null; q?: string | null }) => {
    const params = new URLSearchParams()
    const c = change.category !== undefined ? change.category : category
    const q = change.q !== undefined ? change.q : query
    if (c) params.set('category', c)
    if (q) params.set('q', q)
    const qs = params.toString()
    return qs ? `/business/products?${qs}` : '/business/products'
  }
  const chipHref = (value: string | null) => pageHref({ category: value })

  const readyStock = sortReadyStock(
    products
      .filter((p) => p.isActive && p.readyStock !== null)
      .map((p) => ({ id: p.id, name: p.name, category: p.category, imageUrl: p.imageUrl, readyStock: p.readyStock ?? 0 }))
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader back={{ href: '/business', label: 'Business' }} title="Products" action={<LinkButton href="/business/products/new">Add product</LinkButton>} />

      {products.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🍰"
            title="No products yet"
            text="Add what you sell and what it costs to make. The app works out your profit and margin."
            action={{ href: '/business/products/new', label: 'Add your first product' }}
          />
        </Card>
      ) : (
        <>
        {/* Search + categories stay pinned at the top while scrolling a long list. */}
        <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 bg-base/95 px-4 pb-2 pt-1 backdrop-blur md:-mx-8 md:px-8">
          <ProductSearchBox initial={query} />
          {chips.length > 1 && (
            <nav
              aria-label="Filter by category"
              className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-8 md:px-8 [&::-webkit-scrollbar]:hidden"
            >
              <Link
                href={chipHref(null)}
                scroll={false}
                aria-current={!category ? 'page' : undefined}
                className={clsx(chipClass, !category ? chipOn : chipOff)}
              >
                All <span className="opacity-70">{products.length}</span>
              </Link>
              {chips.map((chip) => (
                <Link
                  key={chip.value}
                  href={chipHref(chip.value)}
                  scroll={false}
                  aria-current={category === chip.value ? 'page' : undefined}
                  className={clsx(chipClass, category === chip.value ? chipOn : chipOff)}
                >
                  {chip.label} <span className="opacity-70">{chip.count}</span>
                </Link>
              ))}
            </nav>
          )}
          {isFiltered && (
            <p className="text-sm text-ink-muted">
              Showing {shown.length} of {products.length}
              {query && <> matching &ldquo;{query}&rdquo;</>} ·{' '}
              <Link href={pageHref({ category: null, q: null })} scroll={false} className="font-medium text-raspberry-dark">
                Clear
              </Link>
            </p>
          )}
        </div>

        {/* Out of the way while searching or filtering, so results come first. */}
        {!isFiltered && <ReadyStockList items={readyStock} title="Ready stock" wide />}

        {shown.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">No products match. Try another category or search.</p>
          </Card>
        ) : isFiltered || chips.length < 2 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => (
              <ProductTile key={p.id} product={p} money={money} />
            ))}
          </ul>
        ) : (
          // "All": grouped under each category, in the same order as the chips.
          <div className="flex flex-col gap-6">
            {chips.map((chip) => {
              const inCategory = filterProducts(shown, { category: chip.value })
              if (inCategory.length === 0) return null
              return (
                <section key={chip.value} aria-label={chip.label}>
                  <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                    <h2 className="font-display text-xl text-ink">{chip.label}</h2>
                    <Link href={chipHref(chip.value)} scroll={false} className="text-sm text-ink-muted">
                      {inCategory.length} →
                    </Link>
                  </div>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {inCategory.map((p) => (
                      <ProductTile key={p.id} product={p} money={money} />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
        </>
      )}
    </div>
  )
}

const chipClass = 'inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-medium'
const chipOn = 'bg-raspberry-soft text-raspberry-dark'
const chipOff = 'bg-base-card text-ink-muted shadow-card hover:text-ink'

/** One product in the grid: big photo, ready-stock tag, name, category, price and margin. */
function ProductTile({ product: p, money }: { product: ProductView; money: (n: number) => string }) {
  const stock = p.readyStock === null ? null : readyStockState(p.readyStock)
  return (
    <li>
      <Link
        href={`/business/products/${p.id}`}
        className={clsx(
          'flex h-full flex-col overflow-hidden rounded-card border border-raspberry/15 bg-base-card shadow-card transition-transform active:scale-[0.98]',
          !p.isActive && 'opacity-60'
        )}
      >
        {/* Square whatever the photo's shape: the photo is pinned inside, so a tall one can't stretch the tile. */}
        <span className="relative block aspect-square w-full shrink-0 overflow-hidden bg-base-soft">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productThumbUrl(p.imageUrl) ?? ''} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-5xl">
              🧁
            </span>
          )}
          {stock && (
            <span
              className={clsx(
                'absolute left-2 top-2 rounded-pill px-2 py-0.5 text-[11px] font-medium shadow-card',
                stock === 'in_stock' ? 'bg-white/90 text-sage-dark' : 'bg-clay text-white'
              )}
            >
              {readyStockLabel(p.readyStock)}
            </span>
          )}
          {!p.isActive && (
            <span className="absolute right-2 top-2 rounded-pill bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-white">Inactive</span>
          )}
        </span>
        <span className="flex flex-1 flex-col p-3">
          <span className="line-clamp-2 text-sm font-medium leading-snug text-ink">{p.name}</span>
          {p.category && <span className="truncate text-xs text-ink-muted">{p.category}</span>}
          <span className="mt-auto flex items-baseline justify-between gap-2 pt-2">
            <span className="font-display text-lg text-ink">{money(p.sellingPrice)}</span>
            {p.grossMargin !== null && (
              <span className={clsx('text-xs', p.grossProfit < 0 ? 'text-clay-dark' : 'text-ink-muted')}>{formatPercent(p.grossMargin)}</span>
            )}
          </span>
        </span>
      </Link>
    </li>
  )
}
