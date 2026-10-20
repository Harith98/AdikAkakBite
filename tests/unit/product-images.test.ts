import { describe, it, expect } from 'vitest'
import { productImageFileNames, productImagePath, productThumbUrl } from '@/lib/product-images'

const SUPABASE = 'https://abc.supabase.co'
const BIZ = '11111111-2222-3333-4444-555555555555'
const ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const base = `${SUPABASE}/storage/v1/object/public/product-images/${BIZ}`

describe('product photo thumbnails', () => {
  it('names the photo and its small copy to match', () => {
    expect(productImageFileNames(BIZ, ID)).toEqual({ full: `${BIZ}/${ID}_full.jpg`, thumb: `${BIZ}/${ID}_thumb.jpg` })
  })

  it('points at the small copy only for photos that have one', () => {
    expect(productThumbUrl(`${base}/${ID}_full.jpg`)).toBe(`${base}/${ID}_thumb.jpg`)
    expect(productThumbUrl(`${base}/${ID}_full.jpg?v=2`)).toBe(`${base}/${ID}_thumb.jpg?v=2`)
    // Older uploads (one file) and links from elsewhere stay as they are.
    expect(productThumbUrl(`${base}/${ID}.jpg`)).toBe(`${base}/${ID}.jpg`)
    expect(productThumbUrl('https://example.com/cake.png')).toBe('https://example.com/cake.png')
    expect(productThumbUrl(null)).toBeNull()
  })

  it('finds both files in storage so both get deleted', () => {
    expect(productImagePath(`${base}/${ID}_full.jpg`, SUPABASE)).toBe(`${BIZ}/${ID}_full.jpg`)
    expect(productImagePath(productThumbUrl(`${base}/${ID}_full.jpg`), SUPABASE)).toBe(`${BIZ}/${ID}_thumb.jpg`)
  })
})
