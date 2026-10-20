/**
 * A colour and emoji per task/schedule category, so each part of the day is
 * recognisable at a glance (Content pink, Production butter, Admin green…).
 * Tailwind classes are written out in full so they're kept in the CSS build.
 */
export interface CategoryStyle {
  emoji: string
  /** Soft background for the icon tile / card tint. */
  soft: string
  /** Text colour that reads on `soft`. */
  text: string
  /** Solid left stripe. */
  stripe: string
  /** Text colour for accents drawn in currentColor (the progress ring). */
  accent: string
}

const PINK: Omit<CategoryStyle, 'emoji'> = { soft: 'bg-raspberry-soft', text: 'text-raspberry-dark', stripe: '!border-l-raspberry', accent: 'text-raspberry' }
const BUTTER: Omit<CategoryStyle, 'emoji'> = { soft: 'bg-amber-soft', text: 'text-amber-dark', stripe: '!border-l-amber', accent: 'text-amber' }
const SAGE: Omit<CategoryStyle, 'emoji'> = { soft: 'bg-sage-soft', text: 'text-sage-dark', stripe: '!border-l-sage', accent: 'text-sage' }
const CLAY: Omit<CategoryStyle, 'emoji'> = { soft: 'bg-clay-soft', text: 'text-clay-dark', stripe: '!border-l-clay', accent: 'text-clay' }
const INK: Omit<CategoryStyle, 'emoji'> = { soft: 'bg-ink/5', text: 'text-ink-muted', stripe: '!border-l-ink-faint', accent: 'text-ink-faint' }

const STYLES: Record<string, CategoryStyle> = {
  content: { emoji: '📸', ...PINK },
  marketing: { emoji: '📣', ...PINK },
  production: { emoji: '🧁', ...BUTTER },
  product_development: { emoji: '🧪', ...BUTTER },
  orders: { emoji: '🧾', ...CLAY },
  sales: { emoji: '💰', ...CLAY },
  customers: { emoji: '💬', ...CLAY },
  inventory: { emoji: '📦', ...SAGE },
  administration: { emoji: '📋', ...SAGE },
  business: { emoji: '💼', ...SAGE },
  cleaning: { emoji: '🧽', ...INK },
}

const BREAK: CategoryStyle = { emoji: '☕', ...INK }

/** Style for a block/task category; blocks titled "Break" get a coffee cup whatever their category. */
export function categoryStyle(category: string | null | undefined, title?: string): CategoryStyle {
  if (title && /break|rehat|lunch|makan/i.test(title)) return BREAK
  return STYLES[category ?? ''] ?? { emoji: '✨', ...INK }
}
