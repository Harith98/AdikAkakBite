'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import clsx from '@/lib/clsx'
import { formatMoney } from '@/lib/constants'
import { limitingIngredient, recipeCostPerBatch, recipeCostPerUnit, unitsMakeable, type RecipeLine } from '@/lib/calc/recipes'
import type { RecipeView } from '@/lib/services/recipes'
import { saveRecipe, applyRecipeCost } from '@/app/(app)/business/products/actions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

interface LineState {
  key: number
  inventoryItemId: string
  quantity: string
}

interface Props {
  productId: string
  recipe: RecipeView
  currency: string
  /** The product's current ingredient cost per unit, to compare with the recipe. */
  ingredientCost: number
  /** Ready stock tracked → ingredients are used when a batch is added; otherwise when an order completes. */
  tracksReadyStock: boolean
}

const toNumber = (v: string) => Number(v.replace(',', '.'))

export function RecipeCard({ productId, recipe, currency, ingredientCost, tracksReadyStock }: Props) {
  const router = useRouter()
  const nextKey = useRef(1)
  const initial = useMemo(
    () => ({
      yield: String(recipe.recipeYield),
      lines: recipe.lines.map((l) => ({ inventoryItemId: l.inventoryItemId, quantity: String(l.quantity) })),
    }),
    [recipe]
  )
  const [recipeYield, setRecipeYield] = useState(initial.yield)
  const [lines, setLines] = useState<LineState[]>(() => initial.lines.map((l) => ({ ...l, key: nextKey.current++ })))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const byId = useMemo(() => new Map(recipe.ingredients.map((i) => [i.id, i])), [recipe.ingredients])
  const money = (n: number) => formatMoney(n, currency)

  const dirty =
    recipeYield !== initial.yield ||
    lines.length !== initial.lines.length ||
    lines.some((l, i) => l.inventoryItemId !== initial.lines[i]?.inventoryItemId || toNumber(l.quantity) !== toNumber(initial.lines[i]?.quantity ?? ''))

  // Live maths from what's on screen.
  const yieldNumber = Math.max(1, Math.floor(toNumber(recipeYield)) || 1)
  const calcLines: (RecipeLine & { name: string; unit: string })[] = lines
    .map((l) => {
      const item = byId.get(l.inventoryItemId)
      const quantity = toNumber(l.quantity)
      return item && quantity > 0
        ? { quantity, unitCost: item.unitCost, currentQuantity: item.currentQuantity, name: item.name, unit: item.unit }
        : null
    })
    .filter((l): l is RecipeLine & { name: string; unit: string } => l !== null)
  const perUnit = recipeCostPerUnit(calcLines, yieldNumber)
  const perBatch = recipeCostPerBatch(calcLines)
  const makeable = unitsMakeable(calcLines, yieldNumber)
  const limiting = limitingIngredient(calcLines)

  const update = (key: number, patch: Partial<LineState>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  async function save() {
    setMessage(null)
    const yieldValue = Number(recipeYield)
    if (!Number.isInteger(yieldValue) || yieldValue < 1) {
      setMessage({ ok: false, text: 'How many a batch makes must be a whole number of at least 1.' })
      return
    }
    const filled = lines.filter((l) => l.inventoryItemId || l.quantity.trim())
    if (filled.some((l) => !l.inventoryItemId || !(toNumber(l.quantity) > 0))) {
      setMessage({ ok: false, text: 'Every line needs an ingredient and an amount above 0.' })
      return
    }
    setBusy(true)
    const result = await saveRecipe(
      productId,
      yieldValue,
      filled.map((l) => ({ inventoryItemId: l.inventoryItemId, quantity: toNumber(l.quantity) }))
    ).catch(() => ({ error: 'Could not save. Check your connection.' }))
    setBusy(false)
    if (result.error) {
      setMessage({ ok: false, text: result.error })
      return
    }
    setMessage({ ok: true, text: 'Recipe saved.' })
    router.refresh()
  }

  async function applyCost() {
    setBusy(true)
    setMessage(null)
    const result = await applyRecipeCost(productId).catch(() => ({ error: 'Could not save. Check your connection.', ingredientCost: null }))
    setBusy(false)
    if (result.error) {
      setMessage({ ok: false, text: result.error })
      return
    }
    setMessage({ ok: true, text: `Ingredient cost set to ${money(result.ingredientCost ?? 0)} per piece.` })
    router.refresh()
  }

  const savedHasRecipe = initial.lines.length > 0
  const costDiffers = savedHasRecipe && !dirty && Math.abs(perUnit - ingredientCost) >= 0.01

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Recipe</p>
      <p className="mt-1 text-sm text-ink-muted">
        What one batch uses, from your inventory.{' '}
        {tracksReadyStock
          ? 'Ingredients come off inventory when you add a batch to ready stock.'
          : 'Ingredients come off inventory when an order with this product is completed.'}
      </p>

      {recipe.ingredients.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">
          Add your ingredients and packaging to{' '}
          <Link href="/business/inventory/new" className="font-medium text-raspberry-dark">
            Inventory
          </Link>{' '}
          first, with their unit and cost, then build the recipe here.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            One batch makes
            <input
              value={recipeYield}
              onChange={(e) => setRecipeYield(e.target.value)}
              inputMode="numeric"
              aria-label="Units one batch makes"
              className={clsx(input, 'w-20 text-center')}
            />
            pieces
          </label>

          <ul className="flex flex-col gap-2">
            {lines.map((line, index) => {
              const item = byId.get(line.inventoryItemId)
              const quantity = toNumber(line.quantity)
              const used = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.inventoryItemId))
              return (
                <li key={line.key} className="flex flex-col gap-2 rounded-card border border-ink/10 p-3">
                  <select
                    value={line.inventoryItemId}
                    onChange={(e) => update(line.key, { inventoryItemId: e.target.value })}
                    aria-label={`Ingredient ${index + 1}`}
                    className={input}
                  >
                    <option value="">Choose an ingredient…</option>
                    {recipe.ingredients.map((i) => (
                      <option key={i.id} value={i.id} disabled={used.has(i.id)}>
                        {i.name} ({i.unit})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      value={line.quantity}
                      onChange={(e) => update(line.key, { quantity: e.target.value })}
                      inputMode="decimal"
                      placeholder="Amount"
                      aria-label={`Ingredient ${index + 1} amount per batch`}
                      className={clsx(input, 'flex-1')}
                    />
                    <span className="w-14 shrink-0 text-sm text-ink-muted">{item?.unit ?? ''}</span>
                    <span className="w-20 shrink-0 text-right text-sm text-ink-muted">
                      {item && quantity > 0 ? money(quantity * item.unitCost) : ''}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove ingredient ${index + 1}`}
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    >
                      ✕
                    </Button>
                  </div>
                  {item && ['kg', 'l', 'litre', 'liter'].includes(item.unit.toLowerCase()) && (
                    <p className="text-xs text-ink-muted">In {item.unit}: 250 g = 0.25</p>
                  )}
                </li>
              )
            })}
          </ul>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setLines((prev) => [...prev, { key: nextKey.current++, inventoryItemId: '', quantity: '' }])}
          >
            + Add ingredient
          </Button>

          {calcLines.length > 0 && (
            <div className="rounded-card bg-base-soft p-4 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>Ingredients per batch</span>
                <span>{money(perBatch)}</span>
              </div>
              <div className="flex justify-between font-medium text-ink">
                <span>Ingredients per piece</span>
                <span>{money(perUnit)}</span>
              </div>
              {makeable !== null && (
                <div className={clsx('mt-1 flex justify-between', makeable === 0 ? 'text-clay-dark' : 'text-ink-muted')}>
                  <span>Can make with stock now</span>
                  <span>
                    {makeable} piece{makeable === 1 ? '' : 's'}
                    {limiting !== null && calcLines[limiting] && ` · ${calcLines[limiting]!.name} runs out first`}
                  </span>
                </div>
              )}
            </div>
          )}

          {costDiffers && (
            <div className="flex flex-col gap-2 rounded-card border border-amber/50 bg-amber-soft p-3 text-sm text-amber-dark">
              <p>
                The product&apos;s ingredient cost is {money(ingredientCost)}, but this recipe works out to {money(perUnit)} per piece.
              </p>
              <Button type="button" variant="secondary" onClick={applyCost} disabled={busy} className="self-start">
                Use {money(perUnit)} as ingredient cost
              </Button>
            </div>
          )}

          <Button type="button" onClick={save} disabled={busy || !dirty}>
            {busy ? 'Saving…' : dirty ? 'Save recipe' : 'Recipe saved'}
          </Button>
        </div>
      )}

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={clsx('mt-3 text-sm', message.ok ? 'text-sage-dark' : 'text-clay-dark')}>
          {message.text}
        </p>
      )}
    </Card>
  )
}
