---
status: passed
phase: 01-foundation-authentication
source: [01-VERIFICATION.md]
started: 2026-04-06T17:00:00Z
updated: 2026-04-06T19:30:00Z
---

## Tests

### 1. Dev server starts and landing page renders
expected: Page loads, centered card with Discord CTA, nav bar, theme matches system preference
result: passed
notes: Clean render, shadcn/ui Maia preset styling, no console errors

### 2. Theme toggle works
expected: Light/dark toggle changes theme, persists after refresh
result: passed

### 3. Mobile responsive layout
expected: Hamburger menu on narrow viewport
result: passed
notes: Hamburger only appears when logged in (auth-gated by design — no nav links to show when logged out). Landing page responsive at 375px.

### 4. Build succeeds cleanly
expected: npm run build completes with no errors
result: passed

### 5. Discord OAuth sign-in
expected: Click Sign in → Discord auth → redirect back with username/avatar in nav
result: passed
notes: Required fixes during UAT — handle_new_user trigger had invalid jsonb cast, auth flow needed redirectTo for local dev. Both fixed and deployed.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None — all tests passed after bug fixes during UAT session.

## Issues Found and Fixed During UAT

1. **handle_new_user trigger crash** — `->>'custom_claims'::jsonb->>'global_name'` was invalid SQL (cast applied to string literal, not result). Fixed to `->'custom_claims'->>'global_name'`. Applied to remote DB via `supabase db query`.

2. **Auth flow needed redirectTo** — Without `redirectTo`, Supabase redirects to Site URL (Netlify production) instead of localhost during development. Fixed by adding `redirectTo: window.location.origin`.

3. **Implicit flow not supported** — Discord only supports authorization code grant. Removed `flowType: 'implicit'` and kept default PKCE flow.
