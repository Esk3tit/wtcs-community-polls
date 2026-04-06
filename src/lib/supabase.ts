import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env.local and fill in your Supabase project values.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
// NOTE: If the spike (Task 1) determines that PKCE flow does NOT provide
// provider_token, add { auth: { flowType: 'implicit' } } as third argument.
// See RESEARCH.md Open Question 1.
