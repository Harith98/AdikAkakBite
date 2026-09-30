'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { deleteInventoryItem, saveInventoryItem, type SaveItemState } from '@/app/(app)/business/inventory/actions'
import type { InventoryItemView } from '@/lib/services/inventory'

const initialState: SaveItemState = { error: null, nonce: 0 }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

export function InventoryItemForm({ item }: { item?: InventoryItemView }) {
  const [state, formAction] = useFormState(saveInventoryItem, initialState)

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-4">
        {item && <input type="hidden" name="itemId" value={item.id} />}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Name</span>
          <input name="name" required maxLength={100} defaultValue={item?.name} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Category</span>
            <input name="category" maxLength={50} defaultValue={item?.category ?? ''} placeholder="e.g. Baking" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Unit</span>
            <input name="unit" required maxLength={20} defaultValue={item?.unit} placeholder="kg, pcs, L…" className={input} />
          </label>
        </div>

        {!item && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Starting quantity</span>
            <input name="currentQuantity" inputMode="decimal" defaultValue="0" className={input} />
            <span className="text-xs text-ink-faint">After this, stock only changes through logged transactions below.</span>
          </label>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Reorder level</span>
            <input name="reorderLevel" inputMode="decimal" defaultValue={item ? String(item.reorder_level) : '0'} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Unit cost</span>
            <input name="unitCost" inputMode="decimal" defaultValue={item ? String(item.unit_cost) : ''} className={input} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Supplier</span>
            <input name="supplier" maxLength={100} defaultValue={item?.supplier ?? ''} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Expiry date</span>
            <input type="date" name="expiryDate" defaultValue={item?.expiry_date ?? ''} className={input} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Notes</span>
          <textarea name="notes" rows={2} maxLength={500} defaultValue={item?.notes ?? ''} className="rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry" />
        </label>

        {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
        {state.nonce !== 0 && !state.error && <p className="text-sm text-sage-dark">Saved.</p>}
        <SubmitButton label={item ? 'Save changes' : 'Add item'} />
      </form>

      {item && (
        <form
          action={deleteInventoryItem}
          onSubmit={(e) => {
            if (!confirm(`Delete "${item.name}"? This also removes its transaction history.`)) e.preventDefault()
          }}
          className="mt-2"
        >
          <input type="hidden" name="itemId" value={item.id} />
          <Button type="submit" variant="ghost" className="w-full text-clay-dark">
            Delete item
          </Button>
        </form>
      )}
    </div>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Saving…' : label}
    </Button>
  )
}
