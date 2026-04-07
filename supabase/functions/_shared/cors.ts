const ALLOWED_ORIGINS = [
  'https://polls.wtcsmapvote.com',
  'http://localhost:5173',
]

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN')
  const resolvedOrigin = allowedOrigin ?? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// Static fallback for cases where request is not available
export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://polls.wtcsmapvote.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
