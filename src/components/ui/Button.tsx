import { type ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from '@/lib/clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-pill font-body font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-raspberry',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  )
})
