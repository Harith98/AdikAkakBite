import { type ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from '@/lib/clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Saving: shows a small spinner and blocks a second tap. */
  loading?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-raspberry text-white hover:bg-raspberry-dark',
  secondary: 'bg-base-soft text-ink hover:bg-amber-soft border border-ink/10',
  ghost: 'bg-transparent text-ink hover:bg-base-soft',
  danger: 'bg-clay text-white hover:bg-clay/90',
  success: 'bg-sage-dark text-white hover:bg-sage-dark/90',
}

const sizeStyles: Record<Size, string> = {
  md: 'h-11 px-4 text-sm',
  // Large touch targets for the one-handed mobile workflow (spec §44/45).
  lg: 'h-14 px-6 text-base',
}

/** A small ring that spins while something saves. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={clsx('spinner h-4 w-4 shrink-0', className)} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-pill font-body font-medium transition-[background-color,transform] active:scale-[0.97]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-raspberry',
        'disabled:pointer-events-none',
        // A saving button stays solid (with its spinner); only a truly unavailable one fades.
        loading ? 'cursor-wait' : 'disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
})
