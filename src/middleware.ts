import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { menuHostname } from '@/lib/site-url'

export async function middleware(request: NextRequest) {
  const menuHost = menuHostname()
  if (menuHost) {
    const host = (request.headers.get('host') ?? '').split(':')[0]!.toLowerCase()
    const { pathname } = request.nextUrl

    // The customer menu's own address: only the menu exists here. Every path
    // (/today, /login, /api/…) shows the menu; no app page, login or API is
    // reachable, and no session cookie is read or set.
    if (host === menuHost) {
      if (pathname === '/menu') return NextResponse.next()
      const url = request.nextUrl.clone()
      url.pathname = '/menu'
      url.search = ''
      return NextResponse.rewrite(url)
    }

    // The app's address: old /menu links move to the menu's own address, so
    // customers are never left on the app's domain.
    if (pathname === '/menu') return NextResponse.redirect(`https://${menuHost}/`, 308)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest.json, sw.js, icons (PWA assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)',
  ],
}
