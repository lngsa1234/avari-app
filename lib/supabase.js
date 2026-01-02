import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Create singleton Supabase client
// IMPORTANT: This is exported as a constant, not a function
// This ensures the same client instance is used everywhere,
// which is critical for stable useEffect dependencies in AuthProvider
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in local storage
    persistSession: true,
    // Auto-refresh tokens
    autoRefreshToken: true,
    // Detect session in URL (for OAuth flows)
    detectSessionInUrl: true,
  },
})
