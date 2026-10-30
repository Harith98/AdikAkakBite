import Link from 'next/link'
import { productThumbUrl } from '@/lib/product-images'
import { BackLink } from '@/components/ui/PageHeader'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProduct, getProductCategories } from '@/lib/services/products'
import { getRecipe } from '@/lib/services/recipes'
import { formatMoney, formatPercent } from '@/lib/constants'
import { readyStockLabel, readyStockState } from '@/lib/calc/products'
import { UUID_PATTERN } from '@/lib/validation/common'
import clsx from '@/lib/clsx'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ProductForm } from '@/components/business/ProductForm'
import { ReadyStockCard } from '@/components/business/ReadyStockCard'
import { RecipeCard } from '@/components/business/RecipeCard'
import { getCostHistory, getRecipeCostChecks } from '@/lib/services/cost-checks'
import { RecipeCostAlert } from '@/components/business/RecipeCostAlert'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { formatDateShort } from '@/lib/time'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'stock', label: 'Stock' },
  { key: 'recipe', label: 'Recipe' },
] as const
type Tab = (typeof TABS)[number]['key']

export default async function ProductPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()
  const tab: Tab = TABS.some((t) => t.key === searchParams.tab) ? (searchParams.tab as Tab) : 'details'
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()

  // Each tab loads only what it shows.
  const [product, categories, recipe, costChecks, costHistory] = await Promise.all([
    getProduct(supabase, business.id, params.id),
    tab === 'details' ? getProductCategories(supabase, business.id) : Promise.resolve([]),
    tab === 'recipe' ? getRecipe(supabase, business.id, params.id) : Promise.resolve(null),
    getRecipeCostChecks(supabase, business.id, params.id),
    tab === 'details' ? getCostHistory(supabase, params.id) : Promise.resolve([]),
  ])
  if (!product) notFound()
  const money = (n: number) => formatMoney(n, settings.currency)
  const stockState = readyStockState(product.readyStock)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <BackLink href="/business/products" label="Products" />
        <div className="flex items-center gap-4">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productThumbUrl(product.imageUrl) ?? ''} alt="" className="h-16 w-16 shrink-0 rounded-card bg-base-soft object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-base-soft text-3xl">
              🧁
            </span>
          )}
          <div className="min-w-0">
            <p className="break-words font-display text-3xl leading-tight text-ink">{product.name}</p>
            {product.category && <p className="text-sm text-ink-muted">{product.category}</p>}
          </div>
        </div>
        {/* At a glance, whichever tab is open. */}
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{money(product.sellingPrice)}</Badge>
          <Badge tone={product.grossProfit < 0 ? 'clay' : 'neutral'}>
            {product.grossMargin === null ? 'No margin yet' : `${formatPercent(product.grossMargin)} margin`}
          </Badge>
          {stockState === 'untracked' ? (
            <Badge tone="neutral">Made to order</Badge>
          ) : (
            <Badge tone={stockState === 'in_stock' ? 'sage' : 'clay'} dot>
              {readyStockLabel(product.readyStock)}
            </Badge>
          )}
          {!product.isActive && <Badge tone="amber">Inactive</Badge>}
        </div>
      </header>

      <nav aria-label="Product sections" className="grid grid-cols-3 gap-1 rounded-pill bg-ink/5 p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'details' ? `/business/products/${product.id}` : `/business/products/${product.id}?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            replace
            scroll={false}
            className={clsx(
              'flex h-10 items-center justify-center rounded-pill text-sm font-medium transition-colors',
              tab === t.key ? 'bg-base-card text-ink shadow-card' : 'text-ink-muted'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <RecipeCostAlert checks={costChecks.filter((c) => c.outdated)} currency={settings.currency} />

      {tab === 'details' && (
        <>
          <Card>
            {/* Remounts when costs change elsewhere (e.g. "Use recipe cost"), so the form shows the new values. */}
            <ProductForm
              key={`${product.ingredientCost}-${product.packagingCost}-${product.otherCost}`}
              product={product}
              businessId={business.id}
              currency={settings.currency}
              categories={categories}
            />
          </Card>
          {costHistory.length > 0 && (
            <Card>
              <SectionLabel icon="🕰️" className="mb-1">Cost history</SectionLabel>
              <p className="mb-3 text-xs text-ink-muted">
                Each sale uses the cost in effect on its day, so a price rise shows in profit from the day it&apos;s saved. Sales detail
                (Settings → Export) lists the cost used for every sale.
              </p>
              <ol className="flex flex-col divide-y divide-ink/5 text-sm">
                {costHistory.map((c, i) => {
                  const older = costHistory[i + 1]
                  const change = older ? Math.round((c.total - older.total) * 100) / 100 : 0
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-ink">
                          {c.effectiveTo === null ? 'Now' : `Until ${formatDateShort(c.effectiveTo.slice(0, 10))}`}
                          <span className="text-ink-muted"> · from {formatDateShort(c.effectiveFrom.slice(0, 10))}</span>
                        </span>
                        <span className="block text-xs text-ink-muted">
                          Ingredients {money(c.ingredientCost)} · packaging {money(c.packagingCost)} · other {money(c.otherCost)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-medium tabular-nums text-ink">{money(c.total)}</span>
                        {change !== 0 && (
                          <span className={clsx('block text-xs tabular-nums', change > 0 ? 'text-clay-dark' : 'text-sage-dark')}>
                            {change > 0 ? '▲' : '▼'} {money(Math.abs(change))}
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </Card>
          )}
          <p className="text-xs text-ink-muted">
            Changing a cost doesn&apos;t rewrite history — the new cost applies from now, and the old one is kept.
          </p>
        </>
      )}

      {tab === 'stock' && <ReadyStockCard productId={product.id} initialStock={product.readyStock} />}

      {tab === 'recipe' && recipe && (
        <RecipeCard
          productId={product.id}
          recipe={recipe}
          currency={settings.currency}
          ingredientCost={product.ingredientCost}
          tracksReadyStock={product.readyStock !== null}
        />
      )}
    </div>
  )
}
