import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getInventoryItem, getRecentTransactions } from '@/lib/services/inventory'
import { formatDateShort } from '@/lib/time'
import { UUID_PATTERN } from '@/lib/validation/common'
import { Card } from '@/components/ui/Card'
import { InventoryItemForm } from '@/components/business/InventoryItemForm'
import { InventoryStatusBadge } from '@/components/business/InventoryStatusBadge'
import { TransactionForm } from '@/components/business/TransactionForm'

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase', usage: 'Usage', waste: 'Waste', adjustment: 'Adjustment',
}
const TYPE_SIGN: Record<string, string> = { purchase: '+', usage: '−', waste: '−', adjustment: '=' }

export default async function InventoryItemPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()
  const { business } = await getCurrentBusinessContext()
  const supabase = createClient()

  // Independent reads — fetch together. RLS scopes transactions to this business.
  const [item, transactions] = await Promise.all([
    getInventoryItem(supabase, business.id, params.id),
    getRecentTransactions(supabase, params.id),
  ])
  if (!item) notFound()

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/business/inventory" className="text-sm text-ink-muted">← Inventory</Link>
        <p className="mt-2 font-display text-3xl text-ink">{item.name}</p>
        <div className="mt-2 flex items-center gap-3">
          <InventoryStatusBadge status={item.status} />
          <span className="text-sm text-ink-muted">{item.current_quantity} {item.unit} in stock</span>
        </div>
      </header>

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Log a transaction</p>
        <TransactionForm itemId={item.id} unit={item.unit} />
      </Card>

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Recent history</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-ink-muted">No transactions logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <span className="text-ink">{TYPE_LABEL[t.transaction_type]}{t.reference ? ` · ${t.reference}` : ''}</span>
                <span className="text-ink-muted">
                  {TYPE_SIGN[t.transaction_type]}{t.quantity} {t.unit} · {formatDateShort(t.transaction_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-faint">Edit item</p>
        <InventoryItemForm item={item} />
      </Card>
    </div>
  )
}
