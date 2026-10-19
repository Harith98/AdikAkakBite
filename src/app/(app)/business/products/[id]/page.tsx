import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProduct, getProductCategories } from '@/lib/services/products'
import { getRecipe } from '@/lib/services/recipes'
import { UUID_PATTERN } from '@/lib/validation/common'
import { Card } from '@/components/ui/Card'
import { ProductForm } from '@/components/business/ProductForm'
import { ReadyStockCard } from '@/components/business/ReadyStockCard'
import { RecipeCard } from '@/components/business/RecipeCard'

export default async function ProductPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()
  const [product, categories, recipe] = await Promise.all([
    getProduct(supabase, business.id, params.id),
    getProductCategories(supabase, business.id),
    getRecipe(supabase, business.id, params.id),
  ])
  if (!product) notFound()

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/business/products" className="text-sm text-ink-muted">← Products</Link>
        <p className="mt-2 font-display text-3xl text-ink">{product.name}</p>
      </header>
      <ReadyStockCard productId={product.id} initialStock={product.readyStock} />
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
      <RecipeCard
        productId={product.id}
        recipe={recipe}
        currency={settings.currency}
        ingredientCost={product.ingredientCost}
        tracksReadyStock={product.readyStock !== null}
      />
      <p className="text-xs text-ink-muted">
        Changing a cost doesn&apos;t rewrite history — the new cost applies from now, and the old one is kept.
      </p>
    </div>
  )
}
