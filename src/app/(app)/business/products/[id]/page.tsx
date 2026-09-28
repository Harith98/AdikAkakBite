import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProduct } from '@/lib/services/products'
import { UUID_PATTERN } from '@/lib/validation/common'
import { Card } from '@/components/ui/Card'
import { ProductForm } from '@/components/business/ProductForm'

export default async function ProductPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()
  const { business, settings } = await getCurrentBusinessContext()
  const product = await getProduct(createClient(), business.id, params.id)
  if (!product) notFound()

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/business/products" className="text-sm text-ink-muted">← Products</Link>
        <p className="mt-2 font-display text-3xl text-ink">{product.name}</p>
      </header>
      <Card>
        <ProductForm product={product} currency={settings.currency} />
      </Card>
      <p className="text-xs text-ink-muted">
        Changing a cost doesn&apos;t rewrite history — the new cost applies from now, and the old one is kept.
      </p>
    </div>
  )
}
