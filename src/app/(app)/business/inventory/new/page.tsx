import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { InventoryItemForm } from '@/components/business/InventoryItemForm'

export default function NewInventoryItemPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/business/inventory', label: 'Inventory' }} title="Add an item" />
      <Card>
        <InventoryItemForm />
      </Card>
    </div>
  )
}
