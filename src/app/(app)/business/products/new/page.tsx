import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProductCategories } from '@/lib/services/products'
import { Card } from '@/components/ui/Card'
import { ProductForm } from '@/components/business/ProductForm'

export default async function NewProductPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const categories = await getProductCategories(createClient(), business.id)
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/business/products" className="text-sm text-ink-muted">← Products</Link>
        <p className="mt-2 font-display text-3xl text-ink">Add a product</p>
      </header>
      <Card>
        <ProductForm currency={settings.currency} categories={categories} />
      </Card>
    </div>
  )
}
