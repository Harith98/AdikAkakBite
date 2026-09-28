'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { calculateProductEconomics } from '@/lib/calc/products'
import { formatMoney, formatPercent } from '@/lib/constants'
import { deleteProduct, saveProduct, type SaveProductState } from '@/app/(app)/business/products/actions'
import type { ProductView } from '@/lib/services/products'

const initialState: SaveProductState = { error: null, nonce: 0 }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'
const toNumber = (v: string) => Number(v.replace(/[,\s]/g, '')) || 0

export function ProductForm({ product, currency }: { product?: ProductView; currency: string }) {
  const [state, formAction] = useFormState(saveProduct, initialState)
  const [price, setPrice] = useState(product ? String(product.sellingPrice) : '')
  const [ingredient, setIngredient] = useState(product ? String(product.ingredientCost) : '')
  const [packaging, setPackaging] = useState(product ? String(product.packagingCost) : '')
  const [other, setOther] = useState(product ? String(product.otherCost) : '')

  const economics = calculateProductEconomics({
    sellingPrice: toNumber(price),
    ingredientCost: toNumber(ingredient),
    packagingCost: toNumber(packaging),
    otherCost: toNumber(other),
  })

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-4">
        {product && <input type="hidden" name="productId" value={product.id} />}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Name</span>
          <input name="name" required maxLength={100} defaultValue={product?.name} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Category</span>
          <input name="category" maxLength={50} defaultValue={product?.category ?? ''} placeholder="e.g. Brownies" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Selling price</span>
          <input name="sellingPrice" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={input} />
        </label>

        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Cost per unit</legend>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Ingredients
            <input name="ingredientCost" value={ingredient} onChange={(e) => setIngredient(e.target.value)} inputMode="decimal" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Packaging
            <input name="packagingCost" value={packaging} onChange={(e) => setPackaging(e.target.value)} inputMode="decimal" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Other
            <input name="otherCost" value={other} onChange={(e) => setOther(e.target.value)} inputMode="decimal" className={input} />
          </label>
        </fieldset>

        <div className="rounded-card bg-base-soft p-4 text-sm">
          <div className="flex justify-between text-ink-muted"><span>Total cost</span><span>{formatMoney(economics.totalCost, currency)}</span></div>
          <div className="flex justify-between text-ink-muted">
            <span>Gross profit</span>
            <span className={economics.grossProfit < 0 ? 'text-clay-dark' : undefined}>{formatMoney(economics.grossProfit, currency)}</span>
          </div>
          <div className="flex justify-between font-medium text-ink">
            <span>Gross margin</span>
            <span>{economics.grossMargin === null ? '—' : formatPercent(economics.grossMargin)}</span>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Description</span>
          <textarea name="description" rows={2} maxLength={500} defaultValue={product?.description ?? ''} className="rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Image link (optional)</span>
          <input name="imageUrl" defaultValue={product?.imageUrl ?? ''} placeholder="https://…" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Notes</span>
          <textarea name="notes" rows={2} maxLength={500} defaultValue={product?.notes ?? ''} className="rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry" />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} className="h-4 w-4" />
          Active (available to add to orders)
        </label>

        {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
        {state.nonce !== 0 && !state.error && <p className="text-sm text-sage-dark">Saved.</p>}
        <SubmitButton label={product ? 'Save changes' : 'Add product'} />
      </form>

      {product && (
        <form
          action={deleteProduct}
          onSubmit={(e) => {
            if (!confirm(`Delete "${product.name}"? Past orders keep their own copy of its name and price.`)) e.preventDefault()
          }}
          className="mt-2"
        >
          <input type="hidden" name="productId" value={product.id} />
          <Button type="submit" variant="ghost" className="w-full text-clay-dark">
            Delete product
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
