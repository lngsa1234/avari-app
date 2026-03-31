import { supabase } from '@/lib/supabase'

/**
 * Authenticated fetch wrapper for internal API routes.
 *
 * Automatically attaches the current Supabase session token
 * as a Bearer token in the Authorization header.
 *
 * Usage:
 *   import { apiFetch } from '@/lib/apiFetch'
 *   const res = await apiFetch('/api/agent/nudges', {
 *     method: 'POST',
 *     body: JSON.stringify({ userId })
 *   })
 */
export async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  return fetch(url, {
    ...options,
    headers,
  })
}
