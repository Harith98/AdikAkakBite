import { describe, it, expect } from 'vitest'
import { categoryChips, categorySuggestions, filterProducts, UNCATEGORISED } from '@/lib/product-filters'

const products = [
  { name: 'Brownies Klasik', category: 'Brownies' },
  { name: 'Brownies Nutella', category: 'brownies ' },
  { name: 'Kek Batik Indulgence', category: 'Kek' },
  { name: 'Cookies', category: null },
]

describe('categoryChips', () => {
  it('groups spellings case-insensitively, sorts, and puts Uncategorised last', () => {
    expect(categoryChips(products)).toEqual([
      { value: 'brownies', label: 'Brownies', count: 2 },
      { value: 'kek', label: 'Kek', count: 1 },
      { value: UNCATEGORISED, label: 'Uncategorised', count: 1 },
    ])
  })

  it('suggests one spelling per category', () => {
    expect(categorySuggestions(products)).toEqual(['Brownies', 'Kek'])
  })
})

describe('filterProducts', () => {
  it('filters by category key, including uncategorised', () => {
    expect(filterProducts(products, { category: 'brownies' }).map((p) => p.name)).toEqual(['Brownies Klasik', 'Brownies Nutella'])
    expect(filterProducts(products, { category: UNCATEGORISED }).map((p) => p.name)).toEqual(['Cookies'])
  })

  it('searches names and categories, combined with the category filter', () => {
    expect(filterProducts(products, { query: 'batik' }).map((p) => p.name)).toEqual(['Kek Batik Indulgence'])
    expect(filterProducts(products, { category: 'brownies', query: 'nutella' }).map((p) => p.name)).toEqual(['Brownies Nutella'])
  })

  it('returns everything with no filters', () => {
    expect(filterProducts(products, {})).toHaveLength(4)
  })
})
