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

  const imageUrl = str(form, 'imageUrl')
  if (imageUrl) {
    if (imageUrl.length > 500 || !/^https?:\/\//i.test(imageUrl)) return fail('The image link must start with http:// or https://.')
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
    },
  }
}
