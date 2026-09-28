import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getProducts, type ProductView } from '@/lib/services/products'
import { Card } from '@/components/ui/Card'
import { OrderForm } from '@/components/orders/OrderForm'

export default async function NewOrderPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()

  const [products, customersRes] = await Promise.all([
    getProducts(supabase, business.id),
    supabase.from('customers').select('name, phone').eq('business_id', business.id).order('name').limit(500),
  ])
  if (customersRes.error) throw new Error(`Could not load customers: ${customersRes.error.message}`)

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/orders" className="text-sm text-ink-muted">← Orders</Link>
        <p className="mt-2 font-display text-3xl text-ink">New order</p>
      </header>
      {products.length === 0 && (
        <Card className="border border-dashed border-ink/15 bg-transparent shadow-none">
          <p className="text-sm text-ink-muted">
            You haven&apos;t added any products yet, so you can only add custom items.{' '}
            <Link href="/business/products/new" className="font-medium text-raspberry-dark">Add a product</Link>
          </p>
        </Card>
      )}
      <Card>
        <OrderForm
          products={products
            .filter((product: ProductView) => product.isActive)
            .map((product: ProductView) => ({ id: product.id, name: product.name, price: product.sellingPrice }))}
          customers={customersRes.data ?? []}
          currency={settings.currency}
        />
      </Card>
    </div>
  )
}
