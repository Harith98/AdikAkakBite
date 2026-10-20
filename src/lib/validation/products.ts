import {
  fail,
  parseMoney,
  str,
  type FormSource,
  type ParseResult,
} from './common'

export interface ParsedProduct {
  name: string
  category: string | null
  description: string | null
  sellingPrice: number
  ingredientCost: number
  packagingCost: number
  otherCost: number
  imageUrl: string | null
  isActive: boolean
  notes: string | null
  /** Other names customers use (for the WhatsApp paste reader). */
  nicknames: string[]
}

export const MAX_NICKNAMES = 10

/** "batik klasik, kek batik; batik" → ["batik klasik", "kek batik", "batik"]: trimmed and de-duplicated. */
export function parseNicknames(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[,;\n]/)) {
    const name = part.replace(/\s+/g, ' ').trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

export function parseProductForm(form: FormSource): ParseResult<ParsedProduct> {
  const name = str(form, 'name')
  if (!name) return fail('Give the product a name.')
  if (name.length > 100) return fail('The product name is too long.')

  const category = str(form, 'category')
  if (category.length > 50) return fail('The category is too long.')
  const description = str(form, 'description')
  if (description.length > 500) return fail('Keep the description under 500 characters.')
  const notes = str(form, 'notes')
  if (notes.length > 500) return fail('Keep notes under 500 characters.')

  const nicknames = parseNicknames(str(form, 'nicknames'))
  if (nicknames.length > MAX_NICKNAMES) return fail(`Use at most ${MAX_NICKNAMES} nicknames.`)
  if (nicknames.some((n) => n.length > 50)) return fail('Keep each nickname under 50 characters.')

  const imageUrl = str(form, 'imageUrl')
  if (imageUrl) {
    if (imageUrl.length > 500 || !/^https?:\/\//i.test(imageUrl)) return fail('The photo couldn’t be saved. Please add it again.')
  }

  const sellingPrice = parseMoney(str(form, 'sellingPrice'), 'Selling price', 100_000)
  if (!sellingPrice.ok) return sellingPrice
  const ingredientCost = parseMoney(str(form, 'ingredientCost'), 'Ingredient cost', 100_000)
  if (!ingredientCost.ok) return ingredientCost
  const packagingCost = parseMoney(str(form, 'packagingCost'), 'Packaging cost', 100_000)
  if (!packagingCost.ok) return packagingCost
  const otherCost = parseMoney(str(form, 'otherCost'), 'Other cost', 100_000)
  if (!otherCost.ok) return otherCost

  return {
    ok: true,
    value: {
      name,
      category: category || null,
      description: description || null,
      sellingPrice: sellingPrice.value,
      ingredientCost: ingredientCost.value,
      packagingCost: packagingCost.value,
      otherCost: otherCost.value,
      imageUrl: imageUrl || null,
      isActive: form.get('isActive') === 'on',
      notes: notes || null,
      nicknames,
    },
  }
}
