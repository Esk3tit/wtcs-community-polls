// .planning/closure/audit-screenshots.mjs — UIDN-02 + UIDN-03 screenshot matrix harness
// Phase 9 / v1.1 / Issue #18.
// Re-runnable: edit BASE_URL / LOCAL_URL / BREAKPOINTS / *_ROUTES below; nothing else.
//
// Two passes:
//   Pass A — unauth routes against PROD (D-03): 6 widths × 5 routes = 30 PNGs
//   Pass B — auth routes against LOCAL preview (RESEARCH Pattern 2 Option A):
//            6 widths × 2 sub-routes = 12 PNGs (loginAs equivalent inlined)
// Total: 42 PNGs under .planning/closure/artifacts/screenshots/.
//
// Pre-reqs for Pass B (operator runs in a separate shell):
//   1. `supabase start` (local Supabase up at http://localhost:54321)
//   2. `npm run build && npm run preview` (port 4173 — matches e2e/playwright.config.ts default)
//   3. Export VITE_SUPABASE_ANON_KEY (from `supabase status`)
//
// Auth pass uses Phase 8 fixture pattern: signInWithPassword against local Supabase,
// inject session into localStorage via addInitScript BEFORE goto (LO-03 sequencing).
// No on-disk storage-state JSON — session is in-memory only.

import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdir, rm, writeFile, stat as fsStat, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const BASE_URL = 'https://polls.wtcsmapban.com'
const LOCAL_URL = 'http://localhost:4173'   // npm run preview default (matches playwright.config.ts:28)
const BREAKPOINTS = [320, 375, 414, 768, 1024, 1440]
const UNAUTH_ROUTES = [
  // F6 — each route carries a `mustSee` text/regex probed AFTER the screenshot;
  // miss logs a WARN + records into `warnings[]` (does not abort the run — the
  // PNG is still captured for human review).
  { path: '/',           name: 'home',       mustSee: /WTCS|community|polls|suggestions/i },
  { path: '/topics',     name: 'topics',     mustSee: /topics|polls|suggestions/i },
  { path: '/archive',    name: 'archive',    mustSee: /archive|past|closed/i },
  { path: '/auth/error', name: 'auth-error', mustSee: /sign in|login|error|auth/i },
  { path: '/admin',      name: 'admin',      mustSee: /sign in|login|discord/i },                       // captures redirect-to-login
]
const AUTH_ROUTES = [
  // F6 — auth routes assert a known admin element to confirm the session was
  // honored (we did NOT redirect to /auth/error or get bounced to /).
  { path: '/admin/suggestions/new',                                                  name: 'admin-suggestions-new',     mustSee: /title|description|create|new suggestion/i },
  { path: '/admin/suggestions/d0000000-0000-0000-0000-000000000001/edit',            name: 'admin-suggestions-id-edit', mustSee: /edit|update|MiG-29|save/i }, // [E2E SMOKE] fixture poll
]
const ARTIFACTS_DIR = '.planning/closure/artifacts/screenshots'

// Phase 8 fixture inputs — mirrors e2e/helpers/auth.ts + e2e/fixtures/test-users.ts.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0] || 'localhost'
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`
const ADMIN_FIXTURE = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'playwright-user-admin@test.local',
}
const FIXTURE_PASSWORD = 'playwright-fixture-only-do-not-use-in-prod'  // matches export at e2e/fixtures/test-users.ts:49

// F7 — clean prior-run artifacts so acceptance count checks aren't
// contaminated by stale PNGs from earlier runs.
await rm(ARTIFACTS_DIR, { recursive: true, force: true })
await mkdir(ARTIFACTS_DIR, { recursive: true })
const browser = await chromium.launch({ headless: true })
const warnings = []  // F6 — collected per-screenshot DOM-assertion misses

// === Pass A: unauth routes against PRODUCTION ===
{
  const context = await browser.newContext()
  const page = await context.newPage()
  for (const width of BREAKPOINTS) {
    await page.setViewportSize({ width, height: 800 })   // setViewportSize THEN goto (Pitfall 4)
    for (const route of UNAUTH_ROUTES) {
      const url = `${BASE_URL}${route.path}`
      console.log(`[unauth] ${width}px ${url}`)
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/bp-${width}-${route.name}.png`,
        fullPage: true,
      })
      // F6 — DOM assertion (warning-only; does not abort the run).
      const bodyText = await page.locator('body').innerText().catch(() => '')
      const ok = route.mustSee instanceof RegExp ? route.mustSee.test(bodyText) : bodyText.includes(route.mustSee)
      if (!ok) {
        console.warn(`[unauth] WARN bp-${width}-${route.name}: page body did not match mustSee=${route.mustSee}`)
        warnings.push(`bp-${width}-${route.name}: missing mustSee match`)
      }
    }
  }
  await context.close()
}

// === Pass B: auth routes against LOCAL preview build ===
// RESEARCH Pattern 2 Option A — local-build for auth screenshots (documented in evidence file).
{
  // Pitfall 5: probe local server before doing anything else.
  try {
    await fetch(LOCAL_URL, { signal: AbortSignal.timeout(2000) })
  } catch {
    throw new Error(
      `Local preview server not reachable at ${LOCAL_URL}. ` +
      `Start it with \`npm run build && npm run preview\` in a separate shell ` +
      `(see header of this file for full pre-req checklist).`,
    )
  }

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY env var required for auth pass. ' +
      'Run `supabase status` and export the anon key. See e2e/helpers/auth.ts:36-46.',
    )
  }

  // Mint a fixture admin session via signInWithPassword (Phase 8 loginAs analog).
  const supabase = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_FIXTURE.email,
    password: FIXTURE_PASSWORD,
  })
  if (error || !data.session) {
    throw error ?? new Error(`signInWithPassword returned no session for ${ADMIN_FIXTURE.email}`)
  }

  const payload = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
    token_type: data.session.token_type,
    user: data.session.user,
  }

  const context = await browser.newContext()
  const page = await context.newPage()
  // LO-03 sequencing: addInitScript BEFORE any goto.
  await page.addInitScript(
    ([key, value]) => { window.localStorage.setItem(key, value) },
    [STORAGE_KEY, JSON.stringify(payload)],
  )

  for (const width of BREAKPOINTS) {
    await page.setViewportSize({ width, height: 800 })
    for (const route of AUTH_ROUTES) {
      const url = `${LOCAL_URL}${route.path}`
      console.log(`[auth] ${width}px ${url}`)
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/bp-${width}-${route.name}.png`,
        fullPage: true,
      })
      // F6 — DOM assertion: ensure session was honored AND we did not bounce to /auth/error or /.
      const bodyText = await page.locator('body').innerText().catch(() => '')
      const finalUrl = page.url()
      const onAuthErr = finalUrl.includes('/auth/error')
      const ok = !onAuthErr && (route.mustSee instanceof RegExp ? route.mustSee.test(bodyText) : bodyText.includes(route.mustSee))
      if (!ok) {
        console.warn(`[auth] WARN bp-${width}-${route.name}: redirected to ${finalUrl} OR mustSee=${route.mustSee} not present`)
        warnings.push(`bp-${width}-${route.name}: session not honored or mustSee miss (final=${finalUrl})`)
      }
    }
  }
  await context.close()
}

await browser.close()
const total = BREAKPOINTS.length * (UNAUTH_ROUTES.length + AUTH_ROUTES.length)
console.log(`Wrote ${total} screenshots to ${ARTIFACTS_DIR}/`)

// F6 — emit DOM-assertion warning summary so the operator sees route mismatches.
if (warnings.length > 0) {
  console.warn(`\n=== ${warnings.length} DOM-assertion warning(s) ===`)
  for (const w of warnings) console.warn(`  - ${w}`)
  console.warn('Review screenshots manually; flag any incorrect captures in the UIDN-02 evidence file.')
} else {
  console.log('All DOM assertions matched.')
}

// F1 / Decision A — emit/update MANIFEST.json. The manifest IS committed even
// though the binary PNGs are gitignored. It records sha256 + size for every PNG
// so reviewers can verify referenced artifacts exist (and detect bit rot).
{
  const { readdir } = await import('node:fs/promises')
  const path = await import('node:path')
  const manifestPath = '.planning/closure/artifacts/MANIFEST.json'
  let manifest = { entries: [] }
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (!Array.isArray(manifest.entries)) manifest.entries = []
  } catch { /* fresh manifest */ }
  const byPath = new Map(manifest.entries.map((e) => [e.path, e]))
  const recordedAt = new Date().toISOString()
  const files = (await readdir(ARTIFACTS_DIR)).filter((f) => f.endsWith('.png')).sort()
  for (const f of files) {
    const full = path.join(ARTIFACTS_DIR, f)
    const buf = await readFile(full)
    const sha256 = createHash('sha256').update(buf).digest('hex')
    const { size } = await fsStat(full)
    byPath.set(full, { path: full, sha256, sizeBytes: size, recordedAt, kind: 'screenshot' })
  }
  manifest.entries = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
  manifest.updatedAt = recordedAt
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`Updated ${manifestPath} (${manifest.entries.length} total entries)`)
}
