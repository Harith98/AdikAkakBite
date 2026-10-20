import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { toWhatsAppNumber } from '@/lib/receipts'
import { MenuOrderForm } from '@/components/menu/MenuOrderForm'

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Our preorder menu. Fill in your order and send it to us on WhatsApp.',
}

// Public and the same for everyone, so cache it briefly instead of hitting the database per visit.
export const revalidate = 60

interface PublicMenu {
  name: string
  phone: string | null
  menu_pdf_url: string | null
  menu_pdf_updated_at: string | null
}

async function loadMenu(): Promise<PublicMenu | null> {
  // Plain anon client (no cookies): this page is the same for every visitor.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { data, error } = await supabase.rpc('get_public_menu')
  if (error) {
    console.error('Could not load the public menu:', error.message)
    return null
  }
  return (data as PublicMenu | null) ?? null
}

/** Public customer menu: the catalogue PDF, and an order form that sends the WhatsApp template. */
export default async function MenuPage() {
  const menu = await loadMenu()
  const whatsapp = toWhatsAppNumber(menu?.phone)
  const name = menu?.name ?? 'Our menu'
  const updated = menu?.menu_pdf_updated_at
    ? new Date(menu.menu_pdf_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="relative min-h-dvh overflow-hidden bg-base">
      {/* Soft pink → butter wash behind the top of the page, with a few floating treats. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-raspberry-soft via-amber-soft/60 to-base" />
      <span aria-hidden="true" className="pointer-events-none absolute left-6 top-10 rotate-[-12deg] text-3xl opacity-60">🧁</span>
      <span aria-hidden="true" className="pointer-events-none absolute right-8 top-24 rotate-12 text-2xl opacity-50">🍰</span>
      <span aria-hidden="true" className="pointer-events-none absolute left-10 top-56 rotate-6 text-xl opacity-40">🍫</span>

      <div className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-14 pt-10">
        <header className="flex flex-col items-center text-center">
          <span className="h-28 w-28 overflow-hidden rounded-[28px] bg-white shadow-card ring-4 ring-white/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/iconAdik512x512.png?v=2" alt={`${name} logo`} className="h-full w-full object-contain p-1" />
          </span>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink">{name}</h1>
          <p className="mt-1 text-sm text-ink-muted">Homemade desserts, made to order</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-medium">
            <li className="rounded-pill bg-white/80 px-3 py-1.5 text-raspberry-dark shadow-card">🧁 Freshly made</li>
            <li className="rounded-pill bg-white/80 px-3 py-1.5 text-amber-dark shadow-card">📅 Preorder</li>
            <li className="rounded-pill bg-white/80 px-3 py-1.5 text-sage-dark shadow-card">⏳ Limited slots</li>
          </ul>
        </header>

        <section>
          <Step number={1} title="See the menu" />
          {menu?.menu_pdf_url ? (
            <a
              href={menu.menu_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-3 flex items-center gap-4 overflow-hidden rounded-card bg-gradient-to-br from-raspberry to-raspberry-dark p-4 text-white shadow-card transition-transform active:scale-[0.98]"
            >
              {/* a little stack of "pages" */}
              <span aria-hidden="true" className="relative flex h-20 w-16 shrink-0 items-center justify-center">
                <span className="absolute inset-0 translate-x-1.5 translate-y-1 rotate-6 rounded-lg bg-white/30" />
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white text-3xl shadow-card">📖</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl leading-tight">Lihat katalog</span>
                <span className="block text-sm text-white/85">View our full menu &amp; prices</span>
                {updated && <span className="mt-1 block text-xs text-white/70">Updated {updated}</span>}
              </span>
              <span aria-hidden="true" className="text-2xl transition-transform group-hover:translate-x-1">
                →
              </span>
            </a>
          ) : (
            <p className="mt-3 rounded-card bg-base-card p-4 text-center text-sm text-ink-muted shadow-card">
              📖 The menu will be up soon. Message us on WhatsApp in the meantime.
            </p>
          )}
        </section>

        <section>
          <Step number={2} title="Fill in your order" />
          <div className="mt-3 rounded-card border border-raspberry/15 bg-base-card p-5 shadow-card">
            <MenuOrderForm whatsappNumber={whatsapp} />
          </div>
        </section>

        <section className="rounded-card border border-amber/40 bg-amber-soft/70 p-5">
          <p className="flex items-center gap-2 font-display text-lg text-ink">
            <span aria-hidden="true">📝</span> Maklumat tempahan
          </p>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm text-ink">
            {[
              ['⏰', 'Tempahan dibuat sekurang-kurangnya 1 hari awal.'],
              ['🧺', 'Tempahan hari yang sama tertakluk kepada slot dan stok semasa.'],
              ['💬', 'Sebarang perubahan tempahan perlu dimaklumkan lebih awal.'],
            ].map(([icon, text]) => (
              <li key={text} className="flex gap-3">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-white text-sm shadow-card">
                  {icon}
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="pt-2 text-center text-xs text-ink-faint">Made with 🧁 by {name}</footer>
      </div>
    </div>
  )
}

/** A numbered step heading: (1) See the menu. */
function Step({ number, title }: { number: number; title: string }) {
  return (
    <p className="flex items-center gap-2.5 px-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-raspberry text-sm font-semibold text-white shadow-card">
        {number}
      </span>
      <span className="font-display text-xl text-ink">{title}</span>
    </p>
  )
}
