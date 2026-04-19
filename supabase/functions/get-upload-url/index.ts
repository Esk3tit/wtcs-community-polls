// supabase/functions/get-upload-url/index.ts
//
// Admin-gated signed upload URL minting for the poll-images bucket.
// Server-side validates contentType against jpeg/png/webp allowlist
// (T-04-03 mitigation: SVG explicitly excluded so script injection
// via image is impossible). Filename is sanitized before path construction
// and prefixed with crypto.randomUUID() so collisions are impossible.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin, adminCheckResponse } from '../_shared/admin-auth.ts'

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(cors as Record<string, string>), 'Content-Type': 'application/json' },
  })
}

function sanitizeFilename(name: string): string {
  // Allow alphanumerics, dot, underscore, dash. Replace anything else with _.
  // Also collapse to a max length of 100 to keep paths sane.
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100)
  return cleaned.length > 0 ? cleaned : 'upload'
}

// ME-02: force the on-disk filename extension to match the validated
// contentType so browsers / CDNs that sniff by extension never disagree
// with the stored Content-Type header. Security is still enforced by
// the EF's contentType allowlist + Supabase Storage's MIME allowlist at
// PUT time; this is a UX / cache-consistency hardening.
function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    default: return 'bin'
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, corsHeaders)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401, corsHeaders)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const adminCheck = await requireAdmin(supabaseAdmin, user.id)
    if (!adminCheck.ok) { const r = adminCheckResponse(adminCheck); return json({ error: r.error }, r.status, corsHeaders) }

    let body: { filename?: unknown; contentType?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const filename = typeof body.filename === 'string' ? body.filename : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType : ''
    if (!filename) {
      return json({ error: 'Missing filename' }, 400, corsHeaders)
    }
    if (!ALLOWED_CONTENT_TYPES.includes(contentType as typeof ALLOWED_CONTENT_TYPES[number])) {
      return json({ error: 'Invalid contentType (allowed: image/jpeg, image/png, image/webp)' }, 400, corsHeaders)
    }

    // ME-02: overwrite any client-supplied extension with the one that
    // matches the validated contentType. Strip the final .ext (if any)
    // from the sanitized base name before appending the canonical ext.
    const sanitized = sanitizeFilename(filename)
    const baseName = sanitized.replace(/\.[^.]+$/, '') || 'upload'
    const canonicalExt = extensionForContentType(contentType)
    const path = `${crypto.randomUUID()}/${baseName}.${canonicalExt}`
    const { data, error } = await supabaseAdmin
      .storage
      .from('poll-images')
      .createSignedUploadUrl(path)
    if (error || !data) {
      console.error('get-upload-url createSignedUploadUrl failed:', error)
      return json({ error: 'Internal error' }, 500, corsHeaders)
    }

    return json(
      { signedUrl: data.signedUrl, token: data.token, path },
      200,
      corsHeaders,
    )
  } catch (err) {
    console.error('get-upload-url error:', err)
    return json({ error: 'Internal error' }, 500, corsHeaders)
  }
})
