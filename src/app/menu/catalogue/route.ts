import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isMissingFunction } from '@/lib/services/db-helpers'
import { PLAN_LIMITS } from '@/lib/system-status'
import { catalogueLimitMessage } from '@/lib/notifications/messages'
import { notifyUser } from '@/lib/notifications/push'

export const dynamic = 'force-dynamic'

interface Opened {
  url: string
  via: 'pdf' | 'link'
  pdf_url: string | null
  pdf_bytes_known: boolean
  alert: boolean
  has_link: boolean
  mode: 'auto' | 'upload' | 'link'
  business_id: string
}

/**
 * The menu's "View catalogue" button. The database decides where it goes (the
 * uploaded PDF, or the Canva / Drive link once 80% of the month's free data is
 * used, depending on the setting), counts the open, and says when to alert the
 * owner and admins (once a month). Counting and alerts never get in the way:
 * the customer always ends up at the catalogue.
 */
export async function GET(request: NextRequest) {
  const admin = createServiceRoleClient()
  const res = admin ? await admin.rpc('open_catalogue', { p_limit_bytes: PLAN_LIMITS.supabase.egressBytes }) : null
  const opened = res && !res.error ? (res.data as Opened | null) : null

  if (res && !res.error && !opened) return noStore(NextResponse.redirect(new URL('/menu', request.url))) // no catalogue at all

  if (opened && /^https:\/\//i.test(opened.url)) {
    const work: Promise<unknown>[] = []
    // The PDF's size is needed for the estimate: measure it once if it isn't known yet.
    if (admin && opened.pdf_url && !opened.pdf_bytes_known) work.push(rememberPdfSize(admin, opened.business_id, opened.pdf_url))
    if (admin && opened.alert) work.push(alertManagers(admin, opened))
    await Promise.allSettled(work)
    return noStore(NextResponse.redirect(opened.url, 302))
  }

  if (res?.error && !isMissingFunction(res.error)) console.error('Could not open the catalogue:', res.error.message)
  return legacyOpen(request)
}

/** Before the database update (or without the admin key): straight to the PDF, counted the old way. */
async function legacyOpen(request: NextRequest) {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data } = await anon.rpc('get_public_menu')
  const menu = data as { menu_pdf_url?: string | null; catalogue_link_url?: string | null } | null
  const target = menu?.menu_pdf_url || menu?.catalogue_link_url
  if (!target || !/^https:\/\//i.test(target)) return noStore(NextResponse.redirect(new URL('/menu', request.url)))
  await createServiceRoleClient()
    ?.rpc('count_catalogue_open')
    .then(
      ({ error }) => error && console.error('Could not count a catalogue open:', error.message),
      () => {}
    )
  return noStore(NextResponse.redirect(target, 302))
}

async function rememberPdfSize(admin: NonNullable<ReturnType<typeof createServiceRoleClient>>, businessId: string, pdfUrl: string) {
  const bytes = await fetch(pdfUrl, { method: 'HEAD', cache: 'no-store' })
    .then((r) => Number(r.headers.get('content-length')) || 0)
    .catch(() => 0)
  if (bytes > 0) await admin.from('businesses').update({ menu_pdf_bytes: bytes }).eq('id', businessId).is('menu_pdf_bytes', null)
}

/** The 80% alert, to every owner and admin's devices. */
async function alertManagers(admin: NonNullable<ReturnType<typeof createServiceRoleClient>>, opened: Opened) {
  const { data } = await admin.from('business_members').select('user_id').eq('business_id', opened.business_id).in('role', ['owner', 'admin'])
  const message = catalogueLimitMessage({ mode: opened.mode, hasLink: opened.has_link })
  await Promise.allSettled((data ?? []).map((m: { user_id: string }) => notifyUser(m.user_id, message)))
}

/** Every tap goes through here, so each one is counted (no caching of the redirect). */
function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store')
  return response
}
