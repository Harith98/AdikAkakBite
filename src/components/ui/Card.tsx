import { type HTMLAttributes, type ReactNode } from 'react'
import clsx from '@/lib/clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={clsx('rounded-card bg-base-card p-5 shadow-card', className)}
      {...props}
    >
      {children}
    </div>
  )
}
