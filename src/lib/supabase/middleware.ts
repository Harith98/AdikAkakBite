import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'
import { safeNextPath } from '@/lib/validation/common'

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes. Called from the root
 * middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Same generic-signature mismatch as client.ts/server.ts; only auth.getUser()
  // is used here so the untyped surface is trivial regardless, but the cast
  // keeps this consistent with the rest of the codebase.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not remove. This call refreshes the auth token and must
  // run before any route logic that depends on the user's session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup')
  const isPublicAsset =
    path.startsWith('/_next') ||
    path.startsWith('/api/auth') || // email-confirmation / magic-link callback must work signed out
    path.startsWith('/invite/') || // invite links explain themselves before asking the person to sign in
    path.startsWith('/manifest.json') ||
    path.startsWith('/sw.js') ||
    path.startsWith('/icons') ||
    path === '/favicon.ico'

  if (!user && !isAuthRoute && !isPublicAsset) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('next', path)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url))
  }

  return response
}
