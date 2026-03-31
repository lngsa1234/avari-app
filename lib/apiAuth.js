import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Verify the authenticated user from an API route request.
 *
 * Accepts auth via:
 *   1. Authorization: Bearer <supabase-access-token>
 *   2. Supabase auth cookie (sb-*-auth-token)
 *
 * Returns { user, error, response }.
 * If auth fails, `response` is a 401 NextResponse ready to return.
 *
 * Usage:
 *   const { user, response } = await authenticateRequest(request)
 *   if (!user) return response
 */
export async function authenticateRequest(request) {
  let token = null

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  if (!token) {
    const cookies = request.cookies
    for (const [name, cookie] of cookies) {
      if (name.includes('auth-token')) {
        try {
          const parsed = JSON.parse(cookie.value)
          if (Array.isArray(parsed) && parsed[0]) {
            token = parsed[0]
          } else if (typeof parsed === 'string') {
            token = parsed
          }
        } catch {
          token = cookie.value
        }
        break
      }
    }
  }

  if (!token) {
    return {
      user: null,
      error: 'No authentication token found',
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return {
      user: null,
      error: error?.message || 'Invalid token',
      response: NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      ),
    }
  }

  return { user, error: null, response: null }
}

/**
 * Verify that a request comes from the internal cron job.
 * Checks for X-Cron-Secret header matching CRON_SECRET env var.
 *
 * Usage in routes that support both user and cron calls:
 *   if (body.batch) {
 *     if (!verifyCronAuth(request)) return cronUnauthorized()
 *     // ... batch logic
 *   }
 */
export function verifyCronAuth(request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const header = request.headers.get('x-cron-secret')
  return header === cronSecret
}

/**
 * Standard 401 response for failed cron auth.
 */
export function cronUnauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized: invalid cron secret' },
    { status: 401 }
  )
}

/**
 * Create a Supabase admin client (service role) for privileged operations.
 * Only call this AFTER authenticateRequest or verifyCronAuth succeeds.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
