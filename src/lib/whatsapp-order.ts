/**
 * Reads a customer's filled-in WhatsApp order template into order-form values.
 *
 *   📦 ORDER
 *   📌 Nama: Aisyah
 *   📅 Tarikh: Sabtu 25/10, 3pm
 *   🎂 Order: 2 Brownies Klasik, 1 kek batik
 *   📲 Phone No: 012-345 6789
 *   🚗 Pickup / COD: COD
 *   📍 Alamat (kalau COD): No 5, Jalan Mawar, Shah Alam
 *
 * Forgiving on purpose: emojis, extra spaces, labels in Malay or English,
 * values on the next line, Malaysian date styles ("25/10", "25 Okt",
 * "Sabtu ini", "esok"), times ("3pm", "3 petang", "15:00"), and quantities
 * ("2 brownies", "brownies x2", "2 kotak brownies"). Pure: no I/O, so it is
 * fully unit-tested. Nothing is saved; the result only fills the form, which
 * the user checks before saving.
 */
import { addDaysISO, daysBetweenISO } from '@/lib/time'
import { isValidISODate } from '@/lib/validation/common'

/** The blank template, for sending to customers. Matches the labels read below. */
export const WHATSAPP_ORDER_TEMPLATE = [
  '📦 ORDER',
  '',
  '📌 Nama:',
  '📅 Tarikh:',
  '🎂 Order:',
  '📲 Phone No:',
  '🚗 Pickup / COD:',
  '📍 Alamat (kalau COD):',
].join('\n')

export interface ProductForMatching {
  id: string
  name: string
  price: number
  /** Helps tell apart products with the same name ("Chocolate" in Brownies vs Indulgence). */
  category?: string | null
  /** Other names customers use ("batik klasik"), matched like the name. */
  nicknames?: string[]
}

/** "4″ Chocolate (Brownies)": the name people see when two products share a name. */
const displayName = (p: ProductForMatching) => (p.category ? `${p.name} (${p.category})` : p.name)

export type ItemMatch = 'matched' | 'ambiguous' | 'unmatched'

export interface ParsedItem {
  /** The words as the customer wrote them, e.g. "2 kotak brownies". */
  text: string
  quantity: number
  match: ItemMatch
  productId: string | null
  /** The product's name when matched, else the customer's wording. */
  productName: string
  unitPrice: number | null
  /** For an ambiguous match: the product names it could be. */
  candidates: string[]
}

export interface ParsedWhatsAppOrder {
  /** False when none of the template's labels were found. */
  recognised: boolean
  customerName: string | null
  phone: string | null
  requiredDate: string | null
  requiredTime: string | null
  /** What the customer wrote for the date, for showing alongside the reading. */
  dateText: string | null
  fulfilment: 'pickup' | 'cod' | null
  address: string | null
  items: ParsedItem[]
  notes: string | null
  /** Things to check before saving, in plain words. */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

type Field = 'name' | 'date' | 'time' | 'order' | 'phone' | 'fulfilment' | 'address' | 'notes'

const LABELS: { field: Field; pattern: RegExp }[] = [
  { field: 'name', pattern: /^(nama|name)\b/i },
  { field: 'date', pattern: /^(tarikh|tarikh\s*\/\s*masa|date|tarikh\s*ambil|tarikh\s*hantar)\b/i },
  { field: 'time', pattern: /^(masa|time|jam)\b/i },
  { field: 'order', pattern: /^(order|pesanan|items?|menu)\b/i },
  { field: 'phone', pattern: /^(phone(\s*no)?|no\.?\s*(tel|telefon|phone|fon|hp)|tel|telefon|hp|whatsapp)\b/i },
  { field: 'fulfilment', pattern: /^(pickup\s*\/\s*cod|pick\s*up\s*\/\s*cod|pickup|pick\s*up|cod|delivery|penghantaran)\b/i },
  { field: 'address', pattern: /^(alamat|address)\b/i },
  { field: 'notes', pattern: /^(nota|notes?|catatan|remarks?)\b/i },
]

/** Leading emojis, bullets and symbols before a label or item. */
const stripLead = (line: string) => line.replace(/^[^\p{L}\p{N}]+/u, '')

/** "Alamat (kalau COD): xyz" → ["address", "xyz"]; null if the line isn't a labelled field. */
function readLabel(rawLine: string): { field: Field; value: string } | null {
  const line = stripLead(rawLine)
  const colon = line.search(/[:：]/)
  if (colon < 0) return null
  const label = line.slice(0, colon).replace(/\(.*?\)/g, '').trim()
  for (const { field, pattern } of LABELS) {
    const m = label.match(pattern)
    // The whole label must be the keyword (plus small extras like "No"), not a sentence.
    if (m && label.length - m[0].length <= 4) return { field, value: line.slice(colon + 1).trim() }
  }
  return null
}

// ---------------------------------------------------------------------------
// Dates and times
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mac: 3, mar: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, june: 6,
  jul: 7, julai: 7, july: 7,
  ogo: 8, ogos: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, november: 11,
  dis: 12, disember: 12, dec: 12, december: 12,
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
const WEEKDAYS: Record<string, number> = {
  isnin: 1, monday: 1, mon: 1,
  selasa: 2, tuesday: 2, tue: 2, tues: 2,
  rabu: 3, wednesday: 3, wed: 3,
  khamis: 4, thursday: 4, thu: 4, thurs: 4,
  jumaat: 5, jumat: 5, friday: 5, fri: 5,
  sabtu: 6, saturday: 6, sat: 6,
  ahad: 7, sunday: 7, sun: 7,
}

const pad = (n: number) => String(n).padStart(2, '0')

function isoWeekdayOf(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

/** A day/month without a year: this year, or next year if it's well in the past (e.g. "5/1" written in December). */
function withYear(day: number, month: number, year: number | null, today: string): string | null {
  const thisYear = Number(today.slice(0, 4))
  let iso = `${year ?? thisYear}-${pad(month)}-${pad(day)}`
  if (!isValidISODate(iso)) return null
  if (year === null && daysBetweenISO(iso, today) > 60) iso = `${thisYear + 1}-${pad(month)}-${pad(day)}`
  return isValidISODate(iso) ? iso : null
}

/** Reads a time and returns it with the rest of the text, so "3pm" isn't mistaken for part of a date. */
export function readTime(text: string): { time: string | null; rest: string } {
  const withPeriod = text.match(
    /\b(?:jam|pukul|pkl|@)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|pagi|ptg|petang|tghari|tengahari|tengah\s+hari|malam|mlm)\b/i
  )
  const twentyFour = text.match(/\b(?:jam|pukul|pkl|@)?\s*([01]?\d|2[0-3]):([0-5]\d)\b/)
  const hourOnly = text.match(/\b(?:jam|pukul|pkl)\s*(\d{1,2})\b/i)
  const m = withPeriod ?? twentyFour ?? hourOnly
  if (!m) return { time: null, rest: text }

  let hour = Number(m[1])
  const minute = Number(m[2] ?? 0)
  const period = (withPeriod ? m[3] ?? '' : '').toLowerCase().replace(/\./g, '').replace(/\s+/g, '')
  if (period === 'am' || period === 'pagi') {
    if (hour === 12) hour = 0
  } else if (period === 'pm' || period === 'ptg' || period === 'petang' || period === 'malam' || period === 'mlm') {
    if (hour < 12) hour += 12
  } else if (period === 'tghari' || period === 'tengahari') {
    if (hour >= 1 && hour <= 6) hour += 12 // "1 tengah hari" = 1pm; "12 tengah hari" = noon
  } else if (!withPeriod && !twentyFour && hour >= 1 && hour <= 7) {
    hour += 12 // "jam 3" for a dessert pickup means 3pm, not 3am
  }
  if (hour > 23 || minute > 59) return { time: null, rest: text }
  return { time: `${pad(hour)}:${pad(minute)}`, rest: text.replace(m[0], ' ') }
}

/** Reads a date in the styles Malaysian customers write, relative to `today` (YYYY-MM-DD). */
export function readDate(text: string, today: string): string | null {
  const t = text.toLowerCase()

  if (/\b(hari\s*ini|harini|today|tdy)\b/.test(t)) return today
  if (/\b(esok|besok|tomorrow|tmrw|tmr)\b/.test(t)) return addDaysISO(today, 1)
  if (/\blusa\b/.test(t)) return addDaysISO(today, 2)

  // 25/10, 25-10-2026, 25.10.26
  const numeric = t.match(/\b(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?\b/)
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : null
    const iso = withYear(Number(numeric[1]), Number(numeric[2]), year, today)
    if (iso) return iso
  }

  // 25 Okt, 25hb Oktober 2026, 25th Oct
  const named = t.match(/\b(\d{1,2})\s*(?:hb|haribulan|st|nd|rd|th)?\s+([a-z]+)\.?(?:\s+(\d{4}))?/)
  if (named && MONTHS[named[2] ?? ''] !== undefined) {
    const iso = withYear(Number(named[1]), MONTHS[named[2] ?? '']!, named[3] ? Number(named[3]) : null, today)
    if (iso) return iso
  }
  // Okt 25
  const monthFirst = t.match(/\b([a-z]+)\.?\s+(\d{1,2})\b/)
  if (monthFirst && MONTHS[monthFirst[1] ?? ''] !== undefined) {
    const iso = withYear(Number(monthFirst[2]), MONTHS[monthFirst[1] ?? '']!, null, today)
    if (iso) return iso
  }

  // Sabtu / Sabtu ini / next Saturday: the next one from today (today counts).
  for (const [word, weekday] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) {
      let ahead = (weekday - isoWeekdayOf(today) + 7) % 7
      if (/\b(depan|next)\b/.test(t) && ahead === 0) ahead = 7
      return addDaysISO(today, ahead)
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Items and product matching
// ---------------------------------------------------------------------------

const UNITS = 'pcs|pc|biji|kotak|box|boxes|bekas|tin|balang|set|tray|loyang|keping|slice|slices|bottle|botol|jar|pack|packs|pek|bungkus'
const LEADING_QTY = new RegExp(`^(\\d{1,3})\\s*(?:x|×)?\\s*(?:(?:${UNITS})\\b\\s*)?(.+)$`, 'i')
const TRAILING_X_QTY = new RegExp(`^(.+?)\\s*(?:x|×)\\s*(\\d{1,3})\\s*(?:(?:${UNITS})\\b)?$`, 'i')
const TRAILING_UNIT_QTY = new RegExp(`^(.+?)\\s+(\\d{1,3})\\s*(?:${UNITS})\\b$`, 'i')
/** "BROWNIES KLASIK-3", "brownies = 2", "brownies: 2" */
const DASH_QTY = new RegExp(`^(.+?)\\s*[-–=:]\\s*(\\d{1,3})\\s*(?:(?:${UNITS})\\b)?$`, 'i')
const BRACKET_QTY =new RegExp(`^(.+?)\\s*[([]\\s*(\\d{1,3})\\s*(?:(?:${UNITS})\\b)?\\s*[)\\]]$`, 'i')

function readItem(raw: string): { name: string; quantity: number } | null {
  let text = stripLead(raw.replace(/^\s*\d{1,2}[.)]\s+/, '')) // "1. Brownies" numbering
    .replace(/\s*[-–—@]?\s*rm\s*\d+(?:[.,]\d{1,2})?\b/gi, '') // "RM17" price mentions
    .replace(/[^\p{L}\p{N}\s()[\]x×.,&'/-]/gu, '') // emojis
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null

  let quantity = 1
  for (const [pattern, qtyIndex, nameIndex] of [
    [LEADING_QTY, 1, 2],
    [TRAILING_X_QTY, 2, 1],
    [TRAILING_UNIT_QTY, 2, 1],
    [DASH_QTY, 2, 1],
    [BRACKET_QTY, 2, 1],
  ] as const) {
    const m = text.match(pattern)
    if (m) {
      quantity = Number(m[qtyIndex])
      text = (m[nameIndex] ?? '').trim()
      break
    }
  }
  text = text.replace(new RegExp(`^(?:${UNITS})\\b\\s*`, 'i'), '').trim()
  return text && quantity > 0 ? { name: text, quantity } : null
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    // Single letters are noise, but single digits are sizes ("6″" vs "8″").
    .filter((w) => w.length > 1 || /\d/.test(w))

/** Same words, ignoring case, punctuation and spacing ("Batik Klasik!" = "batik klasik"). */
const sameWords = (a: string, b: string) => tokens(a).join(' ') === tokens(b).join(' ') && tokens(a).length > 0

/** Edit distance, for small typos ("brownis", "nutela"). */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]!
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j]!
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = temp
    }
  }
  return prev[b.length]!
}

function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4) {
    if (a.startsWith(b) || b.startsWith(a)) return true // brownie / brownies
    return editDistance(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1)
  }
  return false
}

/** 0–1: how well the customer's words describe this product. */
export function matchScore(text: string, productName: string): number {
  const said = tokens(text)
  const product = tokens(productName)
  if (said.length === 0 || product.length === 0) return 0
  const productCovered = product.filter((p) => said.some((s) => wordsMatch(s, p))).length / product.length
  const saidCovered = said.filter((s) => product.some((p) => wordsMatch(s, p))).length / said.length
  if (saidCovered < 0.5) return 0
  return productCovered * 0.6 + saidCovered * 0.4
}

const MATCH_THRESHOLD = 0.6

export function matchProduct(text: string, products: ProductForMatching[]): Pick<ParsedItem, 'match' | 'productId' | 'productName' | 'unitPrice' | 'candidates'> {
  const scored = products
    // The category counts too, so "brownies chocolate" picks Chocolate in Brownies over Chocolate in Indulgence.
    // Nicknames count like names; an exact nickname beats everything, since the owner set it on purpose.
    .map((p) => ({
      p,
      score: Math.max(
        matchScore(text, p.name),
        p.category ? matchScore(text, `${p.name} ${p.category}`) : 0,
        ...(p.nicknames ?? []).map((n) => (sameWords(text, n) ? 1.1 : matchScore(text, n)))
      ),
    }))
    .filter((s) => s.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best) return { match: 'unmatched', productId: null, productName: text, unitPrice: null, candidates: [] }
  const tied = scored.filter((s) => best.score - s.score < 0.05)
  if (tied.length > 1) {
    return { match: 'ambiguous', productId: null, productName: text, unitPrice: null, candidates: tied.map((s) => displayName(s.p)) }
  }
  return { match: 'matched', productId: best.p.id, productName: best.p.name, unitPrice: best.p.price, candidates: [] }
}

// ---------------------------------------------------------------------------
// The whole message
// ---------------------------------------------------------------------------

const PHONE_ANYWHERE = /(\+?6?0[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{4})/

export function parseWhatsAppOrder(message: string, products: ProductForMatching[], today: string): ParsedWhatsAppOrder {
  const fields: Partial<Record<Field, string[]>> = {}
  const loose: string[] = []
  let current: Field | null = null

  for (const rawLine of message.replace(/\r/g, '').split('\n')) {
    if (!rawLine.trim()) continue
    const labelled = readLabel(rawLine)
    if (labelled) {
      current = labelled.field
      fields[current] = [...(fields[current] ?? []), ...(labelled.value ? [labelled.value] : [])]
    } else if (current) {
      fields[current] = [...(fields[current] ?? []), rawLine.trim()] // value continued on the next line
    } else if (!/^\W*(order|pesanan|tempahan)\W*$/i.test(stripLead(rawLine))) {
      loose.push(rawLine.trim()) // anything before the first label, except the "📦 ORDER" heading
    }
  }

  const one = (field: Field) => (fields[field] ?? []).join(' ').replace(/\s+/g, ' ').trim() || null
  const warnings: string[] = []

  // Name and phone
  const customerName = one('name')
  let phone = one('phone')
  if (!phone) phone = message.match(PHONE_ANYWHERE)?.[1]?.trim() ?? null
  if (phone) phone = phone.replace(/[^\d+\s-]/g, '').replace(/\s+/g, ' ').trim() || null
  if (!customerName) warnings.push('No name found. Fill in the customer’s name.')
  if (!phone) warnings.push('No phone number found. Add it so repeat orders are linked to the same customer.')

  // Date and time
  const dateText = [one('date'), one('time')].filter(Boolean).join(' ') || null
  let requiredDate: string | null = null
  let requiredTime: string | null = null
  if (dateText) {
    const { time, rest } = readTime(dateText)
    requiredTime = time
    requiredDate = readDate(rest, today)
    if (!requiredDate) warnings.push(`Couldn’t read the date “${dateText}”. Set it below.`)
    else if (requiredDate < today) warnings.push('The date is in the past. Check it below.')
  } else {
    warnings.push('No date found. Set when it’s needed below.')
  }

  // Items: one per line, or separated by commas, "+", "&", "dan".
  const items: ParsedItem[] = []
  for (const line of fields.order ?? []) {
    for (const piece of line.split(/\s*(?:,|;|\s\+\s|\s&\s|\bdan\b|\band\b)\s*/i)) {
      const item = readItem(piece)
      if (!item) continue
      items.push({ text: piece.trim(), quantity: item.quantity, ...matchProduct(item.name, products) })
    }
  }
  if (items.length === 0) warnings.push('No items found. Add them below.')
  for (const item of items) {
    if (item.match === 'ambiguous') warnings.push(`“${item.text}” could be ${item.candidates.join(' or ')}. Pick the right one below.`)
    if (item.match === 'unmatched') warnings.push(`“${item.text}” isn’t one of your products. Pick one below or keep it as a custom item with a price.`)
  }

  // Pickup / COD and address
  const fulfilmentText = (one('fulfilment') ?? '').toLowerCase()
  const fulfilment: 'pickup' | 'cod' | null = /\b(cod|hantar|delivery|deliver|penghantaran|antar)\b/.test(fulfilmentText)
    ? 'cod'
    : /\b(pick\s*up|pickup|ambil|self|collect)\b/.test(fulfilmentText)
      ? 'pickup'
      : null
  const address = one('address')?.replace(/[\s.,;]+$/, '') || null // "…, Penang ." → "…, Penang"
  if (fulfilment === 'cod' && !address) warnings.push('COD but no address given. Ask the customer for it.')
  if (fulfilment === 'cod') warnings.push('COD: add the delivery fee below if you charge one.')

  const notes =
    [
      fulfilment === 'cod' ? `COD${address ? ` — ${address}` : ''}` : fulfilment === 'pickup' ? 'Pickup' : address ? `Alamat: ${address}` : null,
      one('notes'),
      loose.length > 0 ? loose.join(' ') : null,
    ]
      .filter(Boolean)
      .join('\n') || null

  return {
    recognised: Object.keys(fields).length > 0,
    customerName,
    phone,
    requiredDate,
    requiredTime,
    dateText,
    fulfilment,
    address,
    items,
    notes,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Writing the template (the customer menu's order form)
// ---------------------------------------------------------------------------

export interface WhatsAppOrderFields {
  name: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM, optional */
  time?: string
  /** What they're ordering, in their own words (one item per line is fine). */
  order: string
  phone: string
  fulfilment: 'pickup' | 'cod'
  address?: string
}

/** "2026-10-25" + "15:00" → "25/10/2026, 3pm": a form the template reader understands. */
function templateDate(iso: string, time?: string): string {
  const [y, m, d] = iso.split('-')
  const date = `${Number(d)}/${Number(m)}/${y}`
  if (!time) return date
  const [hh, mm] = time.split(':').map(Number)
  const hour = hh ?? 0
  return `${date}, ${hour % 12 || 12}${mm ? `.${String(mm).padStart(2, '0')}` : ''}${hour < 12 ? 'am' : 'pm'}`
}

/** The shop's template, filled in, exactly as WHATSAPP_ORDER_TEMPLATE lays it out. */
export function buildWhatsAppOrderMessage(fields: WhatsAppOrderFields): string {
  const order = fields.order
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return [
    '📦 ORDER',
    '',
    `📌 Nama: ${fields.name.trim()}`,
    `📅 Tarikh: ${templateDate(fields.date, fields.time)}`,
    // One item: on the label's line. Several: one per line under it (the reader handles both).
    order.length <= 1 ? `🎂 Order: ${order[0] ?? ''}` : ['🎂 Order:', ...order.map((l) => `- ${l.replace(/^[-•*]\s*/, '')}`)].join('\n'),
    `📲 Phone No: ${fields.phone.trim()}`,
    `🚗 Pickup / COD: ${fields.fulfilment === 'cod' ? 'COD' : 'Pickup'}`,
    `📍 Alamat (kalau COD): ${fields.fulfilment === 'cod' ? (fields.address ?? '').trim() : '-'}`,
  ].join('\n')
}
