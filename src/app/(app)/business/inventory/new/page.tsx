import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { InventoryItemForm } from '@/components/business/InventoryItemForm'

export default function NewInventoryItemPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/business/inventory" className="text-sm text-ink-muted">← Inventory</Link>
        <p className="mt-2 font-display text-3xl text-ink">Add an item</p>
      </header>
      <Card>
        <InventoryItemForm />
      </Card>
    </div>
  )
}
