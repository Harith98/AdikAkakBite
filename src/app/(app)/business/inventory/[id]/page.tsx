import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
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
import Link from 'next/link'
import { getRecipeCostChecks } from '@/lib/services/cost-checks'
import { formatMoney } from '@/lib/constants'
import { RecipeCostAlert } from '@/components/business/RecipeCostAlert'

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase', usage: 'Usage', waste: 'Waste', adjustment: 'Adjustment',
}
const TYPE_SIGN: Record<string, string> = { purchase: '+', usage: '−', waste: '−', adjustment: '=' }

export default async function InventoryItemPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()

  // Independent reads — fetch together. RLS scopes transactions to this business.
  const [item, transactions, costChecks] = await Promise.all([
    getInventoryItem(supabase, business.id, params.id),
    getRecentTransactions(supabase, params.id),
    getRecipeCostChecks(supabase, business.id),
  ])
  if (!item) notFound()
  // Products whose recipe uses this ingredient (their cost depends on its price).
  const usedIn = costChecks.filter((c) => c.itemIds.includes(item.id))
  const money = (n: number) => formatMoney(n, settings.currency)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/business/inventory', label: 'Inventory' }} title={<>{item.name}</>}>
        <div className="flex items-center gap-3">
          <InventoryStatusBadge status={item.status} />
          <span className="text-sm text-ink-muted">{item.current_quantity} {item.unit} in stock</span>
        </div>
      </PageHeader>

      <Card>
        <SectionLabel icon="✏️" className="mb-3">Log a transaction</SectionLabel>
        <TransactionForm itemId={item.id} unit={item.unit} />
      </Card>

      <Card>
        <SectionLabel icon="📜" className="mb-3">Recent history</SectionLabel>
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

      <RecipeCostAlert checks={usedIn.filter((c) => c.outdated)} currency={settings.currency} heading={`${item.name}'s price changed`} />

      <Card>
        <SectionLabel icon="✏️" className="mb-4">Edit item</SectionLabel>
        <InventoryItemForm item={item} />
      </Card>

      {usedIn.length > 0 && (
        <Card>
          <SectionLabel icon="🥣" className="mb-1">Used in {usedIn.length} product{usedIn.length === 1 ? '' : 's'}</SectionLabel>
          <p className="mb-3 text-xs text-ink-muted">Ingredient cost per piece, at today&apos;s price. Change the price above and these update.</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {usedIn.map((c) => (
              <li key={c.productId} className="flex items-center justify-between gap-3">
                <Link href={`/business/products/${c.productId}?tab=recipe`} className="min-w-0 truncate text-ink hover:underline">
                  {c.name}
                  {c.category && <span className="text-ink-muted"> · {c.category}</span>}
                </Link>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {money(c.recipeCost)} {c.outdated ? <span className="text-amber-dark">· saved {money(c.savedCost)}</span> : <span className="text-sage-dark">✓</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
