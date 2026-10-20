import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProducts, sortReadyStock } from '@/lib/services/products'
import { ReadyStockList } from '@/components/business/ReadyStockList'
import { formatMoney, formatPercent } from '@/lib/constants'
import { readyStockLabel, readyStockState } from '@/lib/calc/products'
import { categoryChips, filterProducts } from '@/lib/product-filters'
import clsx from '@/lib/clsx'
import { Badge } from '@/components/ui/Badge'
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
  /** Link that keeps the search text while switching category. */
  const chipHref = (value: string | null) => {
    const params = new URLSearchParams()
    if (value) params.set('category', value)
    if (query) params.set('q', query)
    const qs = params.toString()
    return qs ? `/business/products?${qs}` : '/business/products'
  }

  const readyStock = sortReadyStock(
    products
      .filter((p) => p.isActive && p.readyStock !== null)
      .map((p) => ({ id: p.id, name: p.name, category: p.category, imageUrl: p.imageUrl, readyStock: p.readyStock ?? 0 }))
  )

  return (
    <div className="flex max-w-2xl flex-col gap-6">
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
        <div className="flex flex-col gap-3">
          <form action="/business/products" method="get" role="search" className="flex gap-2">
            {category && <input type="hidden" name="category" value={category} />}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search products"
              aria-label="Search products"
              className="h-11 min-w-0 flex-1 rounded-card border border-ink/15 bg-base-card px-3 text-sm outline-none focus:border-raspberry"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-pill border border-ink/10 bg-base-soft px-4 text-sm font-medium text-ink hover:bg-amber-soft"
            >
              Search
            </button>
          </form>

          {chips.length > 1 && (
            <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
              <Link
                href={chipHref(null)}
                aria-current={!category ? 'page' : undefined}
                className={clsx(chipClass, !category ? chipOn : chipOff)}
              >
                All <span className="opacity-70">{products.length}</span>
              </Link>
              {chips.map((chip) => (
                <Link
                  key={chip.value}
                  href={chipHref(chip.value)}
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
              <Link href="/business/products" className="font-medium text-raspberry-dark">
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
        ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/business/products/${p.id}`} className="block">
                <Card className={p.isActive ? 'transition-colors hover:bg-base-soft' : 'opacity-70'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-16 w-16 shrink-0 rounded-card bg-base-soft object-cover"
                        />
                      ) : (
                        <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-base-soft text-2xl">
                          🧁
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="break-words font-display text-xl text-ink">{p.name}</p>
                        {p.category && <p className="text-sm text-ink-muted">{p.category}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="text-lg font-medium text-ink">{money(p.sellingPrice)}</p>
                      {p.readyStock !== null && (
                        <Badge tone={readyStockState(p.readyStock) === 'in_stock' ? 'sage' : 'clay'} dot>
                          {readyStockLabel(p.readyStock)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-xs text-ink-muted">Cost</dt><dd>{money(p.totalCost)}</dd></div>
                    <div>
                      <dt className="text-xs text-ink-muted">Profit</dt>
                      <dd className={p.grossProfit < 0 ? 'text-clay-dark' : undefined}>{money(p.grossProfit)}</dd>
                    </div>
                    <div><dt className="text-xs text-ink-muted">Margin</dt><dd>{p.grossMargin === null ? '—' : formatPercent(p.grossMargin)}</dd></div>
                  </dl>
                  {!p.isActive && <div className="mt-3"><Badge>Inactive</Badge></div>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
        )}
        </>
      )}
    </div>
  )
}

const chipClass = 'inline-flex min-h-10 items-center gap-1.5 rounded-pill px-4 py-1.5 text-sm font-medium'
const chipOn = 'bg-raspberry-soft text-raspberry-dark'
const chipOff = 'bg-base-card text-ink-muted shadow-card hover:text-ink'
