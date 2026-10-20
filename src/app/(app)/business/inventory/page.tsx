import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import clsx from '@/lib/clsx'
import { needsReorder } from '@/lib/calc/inventory'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getInventoryItems } from '@/lib/services/inventory'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LinkButton } from '@/components/ui/LinkButton'
import { InventoryStatusBadge } from '@/components/business/InventoryStatusBadge'

export default async function InventoryPage() {
  const { business } = await getCurrentBusinessContext()
  const items = await getInventoryItems(createClient(), business.id)
  const alerts = items.filter((i) => needsReorder(i.status)).length

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/business', label: 'Business' }} title="Inventory" action={<LinkButton href="/business/inventory/new">Add item</LinkButton>}>
        {alerts > 0 && (
          <p className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-clay-soft px-3 py-1 text-sm font-medium text-clay-dark">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {alerts} item{alerts === 1 ? '' : 's'} need{alerts === 1 ? 's' : ''} attention
          </p>
        )}
      </PageHeader>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            emoji="📦"
            title="No ingredients yet"
            text="Add your ingredients and packaging with a reorder level, and you'll be told before anything runs low."
            action={{ href: '/business/inventory/new', label: 'Add an item' }}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/business/inventory/${item.id}`} className="block">
                <Card
                  className={clsx(
                    'transition-colors hover:bg-base-soft',
                    needsReorder(item.status) && '!border-l-4 !border-l-clay'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl text-ink">{item.name}</p>
                      {item.category && <p className="text-sm text-ink-muted">{item.category}</p>}
                    </div>
                    <InventoryStatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">
                    {item.current_quantity} {item.unit} left · reorder at {item.reorder_level} {item.unit}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
