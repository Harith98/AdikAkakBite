/**
 * Category chips and search for the Products list. Categories are free text,
 * so "Brownies", "brownies " and "BROWNIES" are treated as one category,
 * shown with the spelling used most often.
 */

/** Chip value for products with no category. */
export const UNCATEGORISED = 'none'

export interface CategoryChip {
  /** Value for ?category= (the lower-case key, or UNCATEGORISED). */
  value: string
  label: string
  count: number
}

const keyOf = (category: string | null | undefined) => (category ?? '').trim().toLowerCase()
const isCapitalised = (text: string) => text.charAt(0) !== text.charAt(0).toLowerCase()

export function categoryChips(products: { category: string | null }[]): CategoryChip[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>()
  for (const { category } of products) {
    const key = keyOf(category) || UNCATEGORISED
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() }
    group.count++
    const spelling = (category ?? '').trim()
    if (spelling) group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1)
    groups.set(key, group)
  }

  const chips = Array.from(groups, ([value, group]): CategoryChip => {
    const label =
      value === UNCATEGORISED
        ? 'Uncategorised'
        : Array.from(group.spellings).sort(
            // Most used first; on a tie, a capitalised spelling ("Brownies" over "brownies").
            (a, b) => b[1] - a[1] || Number(isCapitalised(b[0])) - Number(isCapitalised(a[0])) || a[0].localeCompare(b[0])
          )[0]?.[0] ?? value
    return { value, label, count: group.count }
  })
  // Alphabetical, with Uncategorised last.
  return chips.sort((a, b) =>
    a.value === UNCATEGORISED ? 1 : b.value === UNCATEGORISED ? -1 : a.label.localeCompare(b.label)
  )
}

export function filterProducts<T extends { name: string; category: string | null }>(
  products: T[],
  { category, query }: { category?: string | null; query?: string | null }
): T[] {
  const wanted = (category ?? '').trim().toLowerCase()
  const search = (query ?? '').trim().toLowerCase()
  return products.filter((p) => {
    if (wanted) {
      const key = keyOf(p.category) || UNCATEGORISED
      if (key !== wanted) return false
    }
    if (search && !p.name.toLowerCase().includes(search) && !keyOf(p.category).includes(search)) return false
    return true
  })
}

/** Distinct category spellings for the product form's suggestions. */
export function categorySuggestions(products: { category: string | null }[]): string[] {
  return categoryChips(products)
    .filter((c) => c.value !== UNCATEGORISED)
    .map((c) => c.label)
}
