import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProducts, type ProductView } from '@/lib/services/products'
import { Card } from '@/components/ui/Card'
import { NewOrderPanel } from '@/components/orders/NewOrderPanel'
import { getBusinessNow } from '@/lib/time'

export default async function NewOrderPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()

  const [products, customersRes] = await Promise.all([
    getProducts(supabase, business.id),
    supabase.from('customers').select('id, name, phone').eq('business_id', business.id).order('name').limit(500),
  ])
  if (customersRes.error) throw new Error(`Could not load customers: ${customersRes.error.message}`)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/orders', label: 'Orders' }} title="New order" />
      {products.length === 0 && (
        <Card className="border border-dashed border-ink/15 bg-transparent shadow-none">
          <p className="text-sm text-ink-muted">
            You haven&apos;t added any products yet, so you can only add custom items.{' '}
            <Link href="/business/products/new" className="font-medium text-raspberry-dark">Add a product</Link>
          </p>
        </Card>
      )}
      <NewOrderPanel
        products={products
          .filter((product: ProductView) => product.isActive)
          .map((product: ProductView) => ({ id: product.id, name: product.name, category: product.category, price: product.sellingPrice, readyStock: product.readyStock, nicknames: product.nicknames }))}
        customers={customersRes.data ?? []}
        currency={settings.currency}
        today={getBusinessNow(settings.timezone).isoDate}
      />
    </div>
  )
}
