import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProducts } from '@/lib/services/products'
import { formatMoney, formatPercent } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/LinkButton'

export default async function ProductsPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const products = await getProducts(createClient(), business.id)
  const money = (n: number) => formatMoney(n, settings.currency)

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href="/business" className="text-sm text-ink-muted">← Business</Link>
          <p className="mt-2 font-display text-3xl text-ink">Products</p>
        </div>
        <LinkButton href="/business/products/new">Add product</LinkButton>
      </header>

      {products.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            No products yet. Add what you sell, with what it costs you to make, and the app works out your profit and margin.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/business/products/${p.id}`} className="block">
                <Card className={p.isActive ? 'transition-colors hover:bg-base-soft' : 'opacity-70'}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl text-ink">{p.name}</p>
                      {p.category && <p className="text-sm text-ink-muted">{p.category}</p>}
                    </div>
                    <p className="text-lg font-medium text-ink">{money(p.sellingPrice)}</p>
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
    </div>
  )
}
