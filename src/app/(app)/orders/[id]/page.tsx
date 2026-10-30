import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getOrder, type OrderView } from '@/lib/services/orders'
import { getProducts, type ProductView } from '@/lib/services/products'
import { formatMoney } from '@/lib/constants'
import { formatDateShort, formatTime12, getBusinessNow } from '@/lib/time'
import { UUID_PATTERN } from '@/lib/validation/common'
import { Card } from '@/components/ui/Card'
import { OrderForm } from '@/components/orders/OrderForm'
import { OrderStatusControls } from '@/components/orders/OrderStatusControls'
import { OrderStatusBadge, PaymentBadge } from '@/components/orders/StatusBadge'
import { GenerateReceiptForm } from '@/components/orders/GenerateReceiptForm'
import { SaleDateEditor } from '@/components/orders/SaleDateEditor'
import { LinkButton } from '@/components/ui/LinkButton'
import { formatReceiptNumber } from '@/lib/receipts'
import { fetchAllPages } from '@/lib/services/db-helpers'

export default async function OrderPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()

  const [order, products, customersRes] = await Promise.all([
    getOrder(supabase, business.id, params.id),
    getProducts(supabase, business.id),
    fetchAllPages<{ id: string; name: string; phone: string | null }>((from, to) =>
      supabase.from('customers').select('id, name, phone').eq('business_id', business.id).order('name').order('id').range(from, to)
    )
      .then((data) => ({ data, error: null }))
      .catch((e: Error) => ({ data: null, error: e })),
  ])
  if (!order) notFound()
  const orderData: OrderView = order
  const money = (n: number) => formatMoney(n, settings.currency)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/orders', label: 'Orders' }} title={<>{orderData.customerName ?? 'Walk-in'}</>}>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={orderData.status} />
          <PaymentBadge status={orderData.paymentStatus} />
        </div>
      </PageHeader>

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
        {orderData.status === 'completed' && (
          <div className="mt-3 border-t border-ink/10 pt-3">
            <SaleDateEditor
              orderId={orderData.id}
              completedOn={orderData.completedOn}
              today={getBusinessNow(settings.timezone).isoDate}
            />
          </div>
        )}
      </Card>

      <OrderStatusControls orderId={orderData.id} status={orderData.status} />

      {orderData.status === 'completed' && (
        <Card>
          <SectionLabel icon="🧾" className="mb-1">Receipt</SectionLabel>
          {orderData.receiptNumber !== null ? (
            <>
              <p className="mb-3 text-sm text-ink-muted">
                Receipt {formatReceiptNumber(orderData.receiptNumber)} has been issued for this order.
              </p>
              <LinkButton href={`/receipt/${orderData.id}`} className="w-full">
                View / print receipt
              </LinkButton>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-muted">
                Give the customer a receipt with its own number, ready to print, save as PDF or send on WhatsApp.
              </p>
              <GenerateReceiptForm
                orderId={orderData.id}
                balanceLabel={money(orderData.balance)}
                hasBalance={orderData.balance > 0}
                defaultMethod={orderData.paymentMethod}
              />
            </>
          )}
        </Card>
      )}

      <Card>
        <SectionLabel icon="✏️" className="mb-4">Edit order</SectionLabel>
        <OrderForm
          order={orderData}
          products={products.map((product: ProductView) => ({ id: product.id, name: product.isActive ? product.name : `${product.name} (inactive)`, price: product.sellingPrice, category: product.category, readyStock: product.readyStock }))}
          customers={customersRes.data ?? []}
          currency={settings.currency}
        />
      </Card>
    </div>
  )
}
