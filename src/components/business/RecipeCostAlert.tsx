'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from '@/lib/clsx'
import { formatMoney } from '@/lib/constants'
import type { RecipeCostCheck } from '@/lib/calc/cost-checks'
import { updateCostsFromRecipes } from '@/app/(app)/business/products/actions'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Feedback'

interface Props {
  /** Products whose saved cost no longer matches their recipe (outdated only). */
  checks: RecipeCostCheck[]
  currency: string
  /** e.g. "Butter's price changed". Defaults to a general line. */
  heading?: string
}

/**
 * An ingredient price changed, so these products' saved costs are out of date:
 * profit would keep using the old cost. "Update all" saves each recipe's cost
 * as a new dated cost; earlier sales keep the cost they had.
 */
export function RecipeCostAlert({ checks, currency, heading }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (checks.length === 0) return null
  const money = (n: number) => formatMoney(n, currency)

  async function updateAll() {
    setBusy(true)
    setError(null)
    const result = await updateCostsFromRecipes(checks.map((c) => c.productId)).catch(() => ({ updated: 0, error: 'Could not update. Check your connection.' }))
    setBusy(false)
    if (result.error) setError(result.error)
    else toast(`${result.updated} product cost${result.updated === 1 ? '' : 's'} updated from today`)
    router.refresh()
  }

  return (
    <div className="rounded-card border border-amber/50 bg-amber-soft p-4">
      <p className="text-sm font-medium text-amber-dark">
        ⚠️ {heading ?? 'Ingredient prices changed'}: {checks.length} product cost{checks.length === 1 ? ' is' : 's are'} out of date
      </p>
      <p className="mt-1 text-xs text-amber-dark/90">
        Until updated, profit keeps using the old cost. Updating starts the new cost from today; earlier sales keep the cost they had.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {checks.slice(0, 8).map((c) => {
          const up = c.recipeCost > c.savedCost
          return (
            <li key={c.productId} className="flex items-center justify-between gap-3 text-sm">
              <Link href={`/business/products/${c.productId}?tab=recipe`} className="min-w-0 truncate text-ink underline-offset-2 hover:underline">
                {c.name}
                {c.category && <span className="text-ink-muted"> · {c.category}</span>}
              </Link>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {money(c.savedCost)} → <span className={clsx('font-medium', up ? 'text-clay-dark' : 'text-sage-dark')}>{money(c.recipeCost)}</span>
              </span>
            </li>
          )
        })}
        {checks.length > 8 && <li className="text-xs text-ink-muted">and {checks.length - 8} more</li>}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-clay-dark">
          {error}
        </p>
      )}
      <Button type="button" onClick={updateAll} loading={busy} className="mt-3 w-full">
        Update {checks.length === 1 ? 'its cost' : `all ${checks.length}`} to today&apos;s recipe cost
      </Button>
    </div>
  )
}
