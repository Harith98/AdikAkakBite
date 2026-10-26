import { PageHeader } from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProductCategories } from '@/lib/services/products'
import { Card } from '@/components/ui/Card'
import { ProductForm } from '@/components/business/ProductForm'

export default async function NewProductPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const categories = await getProductCategories(createClient(), business.id)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/business/products', label: 'Products' }} title="Add a product" />
      <Card>
        <ProductForm businessId={business.id} currency={settings.currency} categories={categories} />
      </Card>
    </div>
  )
}
