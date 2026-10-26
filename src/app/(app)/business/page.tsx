import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import type { ReactNode } from 'react'

const AVAILABLE: { href: string; title: string; text: string; tone: string; icon: ReactNode }[] = [
  {
    href: '/business/products',
    title: 'Products',
    text: 'Prices, margins & ready stock',
    tone: 'bg-amber-soft text-amber-dark',
    icon: (
      <>
        <path d="M5 21h14l-1.2-8H6.2L5 21z" />
        <path d="M6.2 13a5.8 5.8 0 0 1 11.6 0" />
        <path d="M12 4.5v2" />
      </>
    ),
  },
  {
    href: '/business/customers',
    title: 'Customers',
    text: 'Buyers & repeat orders',
    tone: 'bg-clay-soft text-clay-dark',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M16.5 14.2A5 5 0 0 1 21.5 19" />
      </>
    ),
  },
  {
    href: '/business/inventory',
    title: 'Inventory',
    text: 'Stock levels & reorders',
    tone: 'bg-sage-soft text-sage-dark',
    icon: (
      <>
        <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5z" />
        <path d="M3 7.5v9L12 21l9-4.5v-9" />
        <path d="M12 12v9" />
      </>
    ),
  },
  {
    href: '/business/sales',
    title: 'Sales',
    text: 'Daily, weekly & monthly sales',
    tone: 'bg-raspberry-soft text-raspberry-dark',
    icon: <path d="M4 19v-7M10 19V6M16 19v-9M3 21h18" />,
  },
  {
    href: '/business/expenses',
    title: 'Expenses',
    text: 'Rent, bills, petrol & net profit',
    tone: 'bg-base-soft text-ink',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18" />
        <path d="M16 14.5h2" />
      </>
    ),
  },
]

const COMING = ['Dashboard & goals', 'Forecasts']

export default function BusinessPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Business" subtitle="The numbers behind your dessert business" />

      <div className="grid grid-cols-2 gap-3">
        {AVAILABLE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col gap-3 rounded-card border border-raspberry/20 bg-base-card p-4 shadow-card transition-transform duration-100 active:scale-[0.97] hover:border-raspberry/40"
          >
            <span className="flex items-start justify-between">
              <span className={`flex h-11 w-11 items-center justify-center rounded-card ${item.tone}`}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
              </span>
              <span aria-hidden="true" className="text-ink-faint transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
            <span>
              <span className="block text-base font-medium text-ink">{item.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{item.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-ink-faint">
        <span className="font-medium uppercase tracking-wide">Coming soon:</span> {COMING.join(' · ')}
      </p>
    </div>
  )
}
