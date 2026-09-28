type IconName = 'today' | 'orders' | 'business' | 'content' | 'settings'

interface NavIconProps {
  name: IconName
  active?: boolean
}

const strokeWidth = 1.75

/**
 * Small hand-drawn-feeling line icons, kept intentionally simple and in one
 * consistent stroke weight rather than reaching for an icon library for
 * just five glyphs.
 */
export function NavIcon({ name, active }: NavIconProps) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: active ? 'opacity-100' : 'opacity-80',
  }

  switch (name) {
    case 'today':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      )
    case 'orders':
      return (
        <svg {...common}>
          <path d="M5 8h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      )
    case 'business':
      return (
        <svg {...common}>
          <path d="M4 20V10l8-5 8 5v10" />
          <path d="M9 20v-6h6v6" />
        </svg>
      )
    case 'content':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="12" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.31.35.58.64.77" />
        </svg>
      )
  }
}
