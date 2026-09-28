import type { Config } from 'tailwindcss'

// Design tokens for the "small dessert business control centre" identity.
// See docs/architecture.md for the rationale behind this palette.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#FFFBF5', // warm base, not the generic AI cream
          soft: '#FFF4E8',
          card: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#2E1F16', // espresso-brown, used for text instead of pure black
          muted: '#7A6A5E',
          faint: '#B4A79B',
        },
        raspberry: {
          DEFAULT: '#D64550', // primary accent: CTAs, urgent, selected states
          dark: '#B23540',
          soft: '#FBE6E7',
        },
        sage: {
          DEFAULT: '#8FA377', // status: healthy / OK / positive trend
          soft: '#EAF0E3',
          dark: '#5F7348',
        },
        amber: {
          DEFAULT: '#E8A33D', // status: monitor / low stock / early estimate
          soft: '#FCEFD9',
          dark: '#8A5A0B',
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
