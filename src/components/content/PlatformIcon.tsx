import type { ChecklistPlatform } from '@/lib/content'

const TILE: Record<ChecklistPlatform, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  whatsapp: '#25D366',
}

/** A rounded brand-coloured tile with the platform's glyph in white. */
export function PlatformIcon({ platform, size = 40 }: { platform: ChecklistPlatform; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <rect width="24" height="24" rx="6" fill={TILE[platform]} />
      {platform === 'instagram' && (
        <g fill="none" stroke="#fff" strokeWidth="1.8">
          <rect x="5" y="5" width="14" height="14" rx="4" />
          <circle cx="12" cy="12" r="3.3" />
          <circle cx="16.3" cy="7.7" r="0.6" fill="#fff" stroke="none" />
        </g>
      )}
      {platform === 'facebook' && (
        <path
          fill="#fff"
          d="M13.4 20v-6.6h2.2l.35-2.6h-2.55V9.2c0-.75.22-1.27 1.3-1.27h1.35V5.6c-.24-.03-1.04-.1-1.97-.1-1.95 0-3.28 1.19-3.28 3.37v1.93H8.6v2.6h2.2V20z"
        />
      )}
      {platform === 'whatsapp' && (
        <g>
          <path
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinejoin="round"
            d="M12 4.6a7.4 7.4 0 0 0-6.36 11.2L4.6 19.4l3.7-.97A7.4 7.4 0 1 0 12 4.6z"
          />
          <path
            fill="#fff"
            d="M9.6 8.6c.15-.3.3-.32.47-.32h.4c.13 0 .3 0 .43.33l.58 1.37c.06.15.02.3-.07.42l-.4.5c-.1.1-.14.24-.03.42.27.47 1.15 1.6 2.36 2.05.18.07.32.03.42-.08l.5-.6c.12-.15.27-.17.42-.1l1.34.64c.16.08.26.14.26.3 0 .4-.17 1-.74 1.32-.5.27-1.27.36-2.66-.33-1.7-.83-2.85-2.42-3.03-2.68-.18-.25-.75-1.08-.75-2.03 0-.68.33-1.07.5-1.25z"
          />
        </g>
      )}
    </svg>
  )
}
