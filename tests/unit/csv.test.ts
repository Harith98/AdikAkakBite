import { describe, it, expect } from 'vitest'
import { csvCell, toCsv } from '@/lib/csv'

describe('csv', () => {
  it('quotes commas, quotes and new lines', () => {
    expect(csvCell('No 5, Jalan Mawar')).toBe('"No 5, Jalan Mawar"')
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell('Brownies')).toBe('Brownies')
  })

  it('never lets a value run as a spreadsheet formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+60123')).toBe("'+60123")
    expect(csvCell('@me')).toBe("'@me")
  })

  it('writes numbers, booleans and blanks plainly', () => {
    expect(csvCell(17.5)).toBe('17.5')
    expect(csvCell(true)).toBe('yes')
    expect(csvCell(null)).toBe('')
    expect(csvCell(Number.NaN)).toBe('')
  })

  it('builds a BOM-prefixed, CRLF file with a header row', () => {
    const csv = toCsv(
      [
        { header: 'Name', value: (r: { n: string; p: number }) => r.n },
        { header: 'Price', value: (r) => r.p },
      ],
      [{ n: 'Kek Batik 8″', p: 60 }]
    )
    expect(csv).toBe('﻿Name,Price\r\nKek Batik 8″,60\r\n')
  })
})
