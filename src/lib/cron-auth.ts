import type { NextRequest } from 'next/server'

/**
 * Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" once CRON_SECRET is
 * set in the project's environment variables. Anything else is turned away,
 * including every request when the secret isn't configured.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}
