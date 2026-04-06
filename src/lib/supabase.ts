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

// Type-safe RPC helper — supabase-js v2 generic inference for .rpc() breaks
// under TypeScript 6 when Database includes table definitions. This wrapper
// preserves full type safety at the call site. Remove when supabase-js ships
// a TS6-compatible release.
type RpcFunctions = Database['public']['Functions']

export async function typedRpc<FnName extends string & keyof RpcFunctions>(
  fn: FnName,
  args: RpcFunctions[FnName]['Args']
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.rpc(fn as any, args as any)
}
