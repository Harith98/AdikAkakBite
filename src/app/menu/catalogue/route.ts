import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * The menu's "View catalogue" button: counts one open (for the data-transfer
 * estimate in Settings → System), then sends the customer on to the PDF.
 * Counting never gets in the way: if it fails, the customer still gets the PDF.
 */
export async function GET(request: NextRequest) {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { data } = await anon.rpc('get_public_menu')
  const pdf = (data as { menu_pdf_url?: string | null } | null)?.menu_pdf_url

  if (!pdf || !/^https:\/\//i.test(pdf)) return NextResponse.redirect(new URL('/menu', request.url))

  // Only the server can count (service-role key), so the number can't be inflated from outside.
  await createServiceRoleClient()
    ?.rpc('count_catalogue_open')
    .then(
      ({ error }) => error && console.error('Could not count a catalogue open:', error.message),
      () => {}
    )

  const response = NextResponse.redirect(pdf, 302)
  response.headers.set('Cache-Control', 'no-store') // every open goes through here, so each one is counted
  return response
}
