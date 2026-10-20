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
    <div className="min-h-dvh bg-base px-4 pb-16 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/iconAdik192x192.png" alt="" className="mx-auto h-20 w-20 rounded-card object-contain" />
          <h1 className="mt-3 font-display text-3xl text-ink">{name}</h1>
          <p className="mt-1 text-sm text-ink-muted">Preorder menu · Freshly made · Limited slots</p>
        </header>

        <section className="rounded-card border border-raspberry/20 bg-base-card p-5 text-center shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">1 · See the menu</p>
          {menu?.menu_pdf_url ? (
            <>
              <a
                href={menu.menu_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-raspberry text-base font-medium text-white transition-colors hover:bg-raspberry-dark"
              >
                📖 Lihat katalog / View menu
              </a>
              <p className="mt-2 text-xs text-ink-muted">Opens the PDF{updated ? ` · updated ${updated}` : ''}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">The menu will be up soon. Message us on WhatsApp in the meantime.</p>
          )}
        </section>

        <section className="rounded-card border border-raspberry/20 bg-base-card p-5 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">2 · Fill in your order</p>
          <MenuOrderForm whatsappNumber={whatsapp} />
        </section>

        <section className="px-1 text-sm text-ink-muted">
          <p className="font-medium text-ink">Maklumat tempahan</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Tempahan dibuat sekurang-kurangnya 1 hari awal.</li>
            <li>Tempahan hari yang sama tertakluk kepada slot dan stok semasa.</li>
            <li>Sebarang perubahan tempahan perlu dimaklumkan lebih awal.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
