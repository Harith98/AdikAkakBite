/**
 * CSV for the data export (Settings → Export data). Written so it opens
 * cleanly in Excel and Google Sheets: UTF-8 with a BOM (so "RM" and Malay
 * text, emojis and ″ survive), CRLF line endings, and every value quoted when
 * needed. Values that a spreadsheet would run as a formula (=, +, -, @) are
 * prefixed with ' so an exported customer name can never execute.
 */

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  let text = value
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')]
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
