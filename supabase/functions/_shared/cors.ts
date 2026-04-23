const ALLOWED_ORIGINS = [
  'https://polls.wtcsmapban.com',
  'http://localhost:5173',
  // Vite preview port — used by Playwright E2E (e2e/playwright.config.ts
  // baseURL) and by `npm run preview` locally. CI runs vite preview on
  // :4173 without setting ALLOWED_ORIGIN, so EFs must allowlist it
  // natively or specs that hit EFs (submit-vote, create-poll, etc.) fail
  // CORS.
  'http://localhost:4173',
]

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN')
  // ME-01 (Phase 5 review): for a non-allowlisted request origin, return the
  // literal string 'null' (per the CORS spec) instead of echoing
  // ALLOWED_ORIGINS[0]. Echoing a legitimate production origin to an
  // attacker origin is not an auth bypass (the browser still rejects the
  // mismatch) but it masks misconfiguration and looks like a "success" in
  // logs. 'null' makes the rejection explicit both in browser devtools and
  // server logs. The ALLOWED_ORIGIN env escape hatch is preserved.
  const resolvedOrigin = allowedOrigin ?? (ALLOWED_ORIGINS.includes(origin) ? origin : 'null')
  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // AD-02 (Phase 5 review): include request-method + request-headers in
    // Vary so any intermediary cache can't serve a stale preflight response
    // cached against a different request shape. Supabase EF gateway likely
    // doesn't cache preflights, but this is defense-in-depth clarity.
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  }
}
