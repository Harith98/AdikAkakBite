import Link from 'next/link'
import clsx from '@/lib/clsx'
import { needsReorder } from '@/lib/calc/inventory'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getInventoryItems } from '@/lib/services/inventory'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/LinkButton'
import { InventoryStatusBadge } from '@/components/business/InventoryStatusBadge'

export default async function InventoryPage() {
  const { business } = await getCurrentBusinessContext()
  const items = await getInventoryItems(createClient(), business.id)
  const alerts = items.filter((i) => needsReorder(i.status)).length

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href="/business" className="text-sm text-ink-muted">← Business</Link>
          <p className="mt-2 font-display text-3xl text-ink">Inventory</p>
          {alerts > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-clay-soft px-3 py-1 text-sm font-medium text-clay-dark">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {alerts} item{alerts === 1 ? '' : 's'} need{alerts === 1 ? 's' : ''} attention
            </p>
          )}
        </div>
        <LinkButton href="/business/inventory/new">Add item</LinkButton>
      </header>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            No inventory items yet. Add your ingredients and packaging with a reorder level, and this page
            will flag anything running low.
          </p>
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
