import type { Config } from 'tailwindcss'

// Design tokens for the "small dessert business control centre" identity.
// See docs/architecture.md for the rationale behind this palette.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#FFF9E9', // warm cream inspired by the brand mark
          soft: '#FFF3C9',
          card: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#252627', // charcoal from the logo
          muted: '#6E6A60',
          faint: '#A8A397',
        },
        raspberry: {
          DEFAULT: '#AD566B', // dusty pink accent from the logo
          dark: '#8D4055',
          soft: '#F7E8EC',
        },
        sage: {
          DEFAULT: '#88A17A', // status: healthy / OK / positive trend
          soft: '#EAF0E3',
          dark: '#5F7348',
        },
        amber: {
          DEFAULT: '#E3C75C', // butter-yellow status accent from the logo
          soft: '#FFF5CF',
          dark: '#78611B',
        },
        clay: {
          DEFAULT: '#B4574A', // status: reorder / urgent / negative trend
          soft: '#F6E4E1',
          dark: '#8F3D31',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(46, 31, 22, 0.06), 0 4px 16px rgba(46, 31, 22, 0.06)',
      },
      maxWidth: {
        prose: '38rem',
      },
    },
  },
  plugins: [],
}

export default config
