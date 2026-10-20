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
  /** Added in migration 0027; absent before it's applied. */
  instagram_url?: string | null
  facebook_url?: string | null
  tiktok_url?: string | null
  /** Added in migration 0028. */
  threads_url?: string | null
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
  // Follow-us buttons: only the ones the shop has set (Settings → Business & receipt details).
  const socials = [
    menu?.instagram_url && {
      label: 'Instagram',
      href: menu.instagram_url,
      background: 'linear-gradient(45deg, #F58529, #DD2A7B 55%, #8134AF)',
      icon: (
        <g fill="none" stroke="#fff" strokeWidth="1.9">
          <rect x="4" y="4" width="16" height="16" rx="4.5" />
          <circle cx="12" cy="12" r="3.8" />
          <circle cx="17" cy="7" r="0.7" fill="#fff" stroke="none" />
        </g>
      ),
    },
    menu?.facebook_url && {
      label: 'Facebook',
      href: menu.facebook_url,
      background: '#1877F2',
      icon: <path fill="#fff" d="M13.4 21v-7.5h2.5l.4-2.9h-2.9V8.7c0-.85.24-1.43 1.46-1.43h1.56V4.66c-.27-.04-1.2-.12-2.27-.12-2.24 0-3.78 1.37-3.78 3.89v2.17H7.8v2.9h2.53V21z" />,
    },
    menu?.tiktok_url && {
      label: 'TikTok',
      href: menu.tiktok_url,
      background: '#111111',
      icon: (
        <path
          fill="#fff"
          d="M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3.1v12.4a2.6 2.6 0 1 1-1.8-2.5V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.3-1.6z"
        />
      ),
    },
    menu?.threads_url && {
      label: 'Threads',
      href: menu.threads_url,
      background: '#000000',
      icon: (
        <path
          fill="#fff"
          transform="translate(4 4) scale(0.6667)"
          d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"
        />
      ),
    },
  ].filter((s): s is { label: string; href: string; background: string; icon: JSX.Element } => Boolean(s))
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
          <p className="mt-1 text-sm text-ink-muted">Semanis Senyuman Kamu 💕</p>
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

        {socials.length > 0 && (
          <section className="rounded-card border border-raspberry/15 bg-base-card p-5 shadow-card">
            <p className="flex items-center gap-2 font-display text-lg text-ink">
              <span aria-hidden="true">📱</span> Follow Us
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-pill border border-ink/10 bg-white py-1.5 pl-1.5 pr-4 text-sm font-medium text-ink transition-transform hover:border-ink/20 active:scale-[0.97]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill" style={{ background: s.background }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        {s.icon}
                      </svg>
                    </span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="flex flex-col items-center gap-1 border-t border-ink/10 pt-6 text-center">
          <p className="font-display text-base italic text-ink-muted">Terima kasih kerana menyokong perniagaan kecil kami 💕</p>
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} {name}
          </p>
        </footer>
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
