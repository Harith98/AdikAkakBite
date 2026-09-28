export const DEFAULT_CURRENCY =
  process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? 'MYR'
export const DEFAULT_TIMEZONE =
  process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Kuala_Lumpur'

export const NAV_ITEMS = [
  { href: '/today', label: 'Today', icon: 'today' },
  { href: '/orders', label: 'Orders', icon: 'orders' },
  { href: '/business', label: 'Business', icon: 'business' },
  { href: '/content', label: 'Content', icon: 'content' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
] as const

/** Formats an amount using the business's currency, e.g. "RM 280.00". */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  // Malaysian Ringgit doesn't have a standard Intl currency symbol that
  // reads naturally in-context ("MYR 280.00" vs the familiar "RM 280"), so
  // it's special-cased; everything else falls back to Intl.
  if (currency === 'MYR') {
    return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatPercent(value: number, options?: { signed?: boolean }): string {
  const sign = options?.signed && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export const TASK_CATEGORY_OPTIONS = [
  { value: 'orders', label: 'Orders' },
  { value: 'production', label: 'Production' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'content', label: 'Content' },
  { value: 'sales', label: 'Sales' },
  { value: 'customers', label: 'Customers' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'product_development', label: 'Product Development' },
  { value: 'business', label: 'Business' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'administration', label: 'Administration' },
] as const
