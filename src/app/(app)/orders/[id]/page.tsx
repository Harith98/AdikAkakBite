import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getOrder, type OrderView } from '@/lib/services/orders'
import { getProducts, type ProductView } from '@/lib/services/products'
import { formatMoney } from '@/lib/constants'
import { formatDateShort, formatTime12 } from '@/lib/time'
import { UUID_PATTERN } from '@/lib/validation/common'
import { Card } from '@/components/ui/Card'
import { OrderForm } from '@/components/orders/OrderForm'
import { OrderStatusControls } from '@/components/orders/OrderStatusControls'
import { OrderStatusBadge, PaymentBadge } from '@/components/orders/StatusBadge'

export default async function OrderPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()

  const [order, products, customersRes] = await Promise.all([
    getOrder(supabase, business.id, params.id),
    getProducts(supabase, business.id),
    supabase.from('customers').select('name, phone').eq('business_id', business.id).order('name').limit(500),
  ])
  if (!order) notFound()
  const orderData: OrderView = order
  const money = (n: number) => formatMoney(n, settings.currency)

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/orders" className="text-sm text-ink-muted">← Orders</Link>
        <p className="mt-2 font-display text-3xl text-ink">{orderData.customerName ?? 'Customer'}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <OrderStatusBadge status={orderData.status} />
          <PaymentBadge status={orderData.paymentStatus} />
        </div>
      </header>

      <Card>
        <ul className="text-sm text-ink">
          {orderData.items.map((item: OrderView['items'][number]) => (
            <li key={item.id} className="flex justify-between gap-3 py-0.5">
              <span>{item.quantity} × {item.productName}</span>
              <span className="text-ink-muted">{money(item.quantity * item.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-ink/10 pt-3 text-sm">
          {orderData.discount > 0 && <div className="flex justify-between text-ink-muted"><span>Discount</span><span>− {money(orderData.discount)}</span></div>}
          {orderData.deliveryFee > 0 && <div className="flex justify-between text-ink-muted"><span>Delivery</span><span>{money(orderData.deliveryFee)}</span></div>}
          <div className="flex justify-between font-medium text-ink"><span>Total</span><span>{money(orderData.total)}</span></div>
          <div className="flex justify-between text-ink-muted"><span>Deposit paid</span><span>{money(orderData.deposit)}</span></div>
          <div className="flex justify-between text-ink-muted"><span>Still to pay</span><span>{money(orderData.balance)}</span></div>
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          {orderData.requiredDate
            ? `Needed ${formatDateShort(orderData.requiredDate)}${orderData.requiredTime ? ` at ${formatTime12(orderData.requiredTime)}` : ''}`
            : 'No date set'}
        </p>
      </Card>

      <OrderStatusControls orderId={orderData.id} status={orderData.status} />

      <Card>
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-faint">Edit order</p>
        <OrderForm
          order={orderData}
          products={products.map((product: ProductView) => ({ id: product.id, name: product.isActive ? product.name : `${product.name} (inactive)`, price: product.sellingPrice }))}
          customers={customersRes.data ?? []}
          currency={settings.currency}
        />
      </Card>
    </div>
  )
}
