---
status: diagnosed
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
source:
  - 06-01-SUMMARY.md
  - 06-02-SUMMARY.md
  - 06-02b-SUMMARY.md
  - 06-02c-SUMMARY.md
  - 06-02d-SUMMARY.md
  - 06-03-SUMMARY.md
  - 06-04-SUMMARY.md
started: 2026-04-26T17:00:00Z
updated: 2026-04-27T00:30:00Z
---

## Current Test

[testing paused — 1 skipped item outstanding]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Clear browser site data for the local origin (or open a fresh incognito window). Run `npm run dev` from a clean state. The app boots without errors in terminal or browser console; landing page renders with topics list (or empty-state), and the consent banner appears at bottom-right.
result: pass

### 2. Login Flow (Discord OAuth)
expected: Click "Sign in with Discord" → redirected to Discord OAuth → after authorizing, redirected back to /auth/callback → spinner briefly visible → land on the home page authenticated. No silent wedge on spinner. No console errors.
result: pass

### 3. Consent Banner First Visit
expected: On first visit (no `wtcs_consent` in localStorage), a non-blocking card appears anchored to bottom-right. Body reads exactly: "We can record anonymous usage to help us improve this site." + "No tracking starts until you choose." Two buttons: "Allow" (primary) and "Decline" (outline, NOT red/destructive). Both buttons feel comfortably tap-sized on mobile (~44px tall).
result: pass

### 4. Allow Consent Flow
expected: Click Allow on the banner → banner dismisses immediately → consent chip appears bottom-right with text "Anonymous usage analytics are on. Turn off". No page reload. PostHog network requests start firing on subsequent navigation (visible in Network tab as `/e/` or `/i/` requests to PostHog).
result: issue
reported: "Allow click + chip appearance both work, but no PostHog network requests visible after accepting and navigating different tabs"
severity: major

### 5. Decline Consent Flow (from undecided)
expected: Reset consent state (clear `wtcs_consent` from localStorage, refresh). Banner reappears. Click Decline → banner dismisses → chip appears with text "Anonymous usage analytics are off. Turn on". No PostHog network requests fire. No page reload.
result: pass

### 6. Decline-from-Allow Page Reload (P-02)
expected: With consent set to "allow" (from test 4), click the chip's "Turn off" → page performs a full reload (URL stays the same but the tab refreshes). After reload, chip shows "analytics are off. Turn on". This reload terminates any active Sentry Replay session.
result: pass

### 7. Banner Suppressed on /admin Routes
expected: With consent undecided, navigate directly to `/admin` (or any `/admin/*` route). The consent banner does NOT appear. The chip also does not appear at admin routes when consent is undecided.
result: pass

### 8. Cross-Tab Consent Sync
expected: Open the site in two tabs. In tab A, click the chip to toggle consent (e.g. on → off). In tab B (without refreshing), the chip text updates within ~1s to reflect the new state. No errors in either console.
result: pass

### 9. Favicon + Page Title
expected: Browser tab shows the WTCS-branded favicon (NOT the default Vite React-leaf). Tab title reads "WTCS Community Suggestions" (NOT a lowercase slug like "wtcs-community-polls"). Open DevTools Sources → favicon.svg loads from `/favicon.svg` and renders correctly.
result: pass

### 10. Apple Touch Icon (iOS bookmark)
expected: On iOS Safari (or DevTools mobile-emulation), open the site and use "Add to Home Screen". The home-screen icon shows the WTCS branding on an opaque dark background (#0a0a0a) — NOT transparent and NOT the default Vite icon.
result: skipped

### 11. Auth Error Page Rendering
expected: Trigger an auth error (e.g. interrupt the OAuth flow, or visit `/auth/error?reason=oauth_state_mismatch`). The error page renders correctly with the locked Phase 6 copy. No layout regression. Sentry breadcrumb fires (if you have Sentry inspector open you'll see one logged).
result: issue
reported: "sentry doesn't fire for the error page"
severity: major

### 12. DebugAuthOverlay Activation
expected: With consent set to "allow", append `?auth_debug=1` to any URL and reload. A read-only diagnostic card appears anchored to bottom-LEFT (not right — banner/chip use right). Six sections: Supabase session, PKCE State, sb-* cookies, sb-* localStorage, last 5 Sentry breadcrumbs, console errors. Each section has a Copy button. X button dismisses.
result: issue
reported: "no diagnostic card appeared with anonymous usage analytics turned on"
severity: major

## Summary

total: 12
passed: 8
issues: 3
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "PostHog network requests fire after Allow consent + navigation"
  status: misobservation
  reason: "User reported: Allow click + chip appearance both work, but no PostHog network requests visible after accepting and navigating different tabs"
  severity: not_a_code_defect
  test: 4
  playwright_verified: 2026-04-27
  evidence: |
    Playwright probe with VITE_POSTHOG_KEY set (.env.local already had it) confirmed the full opt-IN flow works:
    - posthog.has_opted_in_capturing() === true after Allow click
    - posthog.has_opted_out_capturing() === false
    - distinct_id and $device_id present in persistence
    - api_host = https://us.i.posthog.com
    - 4 successful [200] POSTs to us.i.posthog.com/e/ and /i/v0/e/ after navigating to /topics
    - The ERR_ABORTED entries seen in the user's DevTools network panel were unload-time beacon requests, which are *expected* and *normal* — beacons that race with page unload abort by design.
  root_cause: "User read DevTools network panel during/around the unload moment of a navigation and saw the aborted beacons but missed the successful POSTs that landed AFTER the next page mounted. PostHog's `capture_pageview: 'history_change'` config only fires on history changes, so a single Allow click on the home page produces no event until the user navigates. Beacons + successful events look very similar at a glance."
  artifacts:
    - path: "src/lib/posthog.ts"
      issue: "Working as designed — no code change needed"
  missing:
    - "Re-test Test 4 with the network filter set to `posthog.com` and confirm at least one [200] POST after navigating between routes"
    - "Optional dev-quality follow-up SHIPPED in 260427-c5d: console.warn when key is missing so the silent-failure case is now loud"
  confidence: verified_by_playwright

- truth: "Sentry breadcrumb fires on AuthErrorPage useEffect"
  status: real_bug_in_overlay_only
  reason: "User reported: sentry doesn't fire for the error page"
  severity: minor
  test: 11
  playwright_verified: 2026-04-27
  evidence: |
    Playwright probe of /auth/error?reason=auth-failed&debug=auth (with VITE_SENTRY_DSN set, BrowserClient initialized, dsn=o4510971582349312.ingest.us.sentry.io) found:
    - Sentry IS fully initialized (BrowserClient present, DSN configured)
    - 7 breadcrumbs in __SENTRY__["10.49.0"].defaultIsolationScope._breadcrumbs, including the AuthErrorPage one:
        {category: "auth", message: "AuthErrorPage rendered"}
        {category: "auth", message: "AuthContext mounted"}
        {category: "auth", message: "getSession() resolved"}
        {category: "auth", message: "onAuthStateChange: INITIAL_SESSION"}
        ... etc.
    - 0 breadcrumbs in defaultCurrentScope._breadcrumbs
    - The DebugAuthOverlay's "Recent Sentry breadcrumbs (last 5)" section shows "(none)" — even after the live-refresh fix from 260427-cdi
  root_cause: |
    The breadcrumb code is working perfectly. AuthErrorPage.tsx:52-59 fires Sentry.addBreadcrumb on every mount, the breadcrumb lands in the **isolation scope** (Sentry v10 default behavior — addBreadcrumb writes to isolation scope, not current scope).

    But DebugAuthOverlay's snapshotBreadcrumbs() at line 92-93 reads from getCurrentScope() only:
      const scope = Sentry.getCurrentScope().getScopeData()
      return (scope.breadcrumbs ?? [])

    Sentry's getScopeData() on the current scope returns ONLY the current-scope breadcrumbs, not the merged set. The user's report ("doesn't fire") was actually about the OVERLAY display — not about Sentry itself. The breadcrumbs are real and present; the overlay was just looking in the wrong drawer.
  artifacts:
    - path: "src/components/debug/DebugAuthOverlay.tsx:92-93"
      issue: "snapshotBreadcrumbs() reads getCurrentScope() but addBreadcrumb writes to isolation scope. Need to read getIsolationScope() (or merge current+isolation+global)."
    - path: "src/components/auth/AuthErrorPage.tsx:52-59"
      issue: "Working correctly — breadcrumb fires every mount, lands in isolation scope as expected"
    - path: "src/main.tsx:24"
      issue: "Working correctly — Sentry.init runs with valid DSN; BrowserClient created"
  missing:
    - "Fix snapshotBreadcrumbs() to merge isolation + current + global scopes, OR switch to Sentry.getIsolationScope().getScopeData().breadcrumbs"
    - "Optional: add a unit test asserting that breadcrumbs added via Sentry.addBreadcrumb appear in the overlay's snapshot output"
  confidence: verified_by_playwright
  related_issue: "Distinct from issue #17 (ErrorBoundary). This is purely a debug-tool display bug; production Sentry capture is unaffected since errors flush their own merged-scope breadcrumb set when shipped."

- truth: "DebugAuthOverlay renders when ?auth_debug=1 with analytics consent allowed"
  status: uat_script_error
  reason: "User reported: no diagnostic card appeared with anonymous usage analytics turned on"
  severity: not_a_code_defect
  test: 12
  playwright_verified: 2026-04-27
  evidence: "Playwright probe of http://localhost:5173/?debug=auth confirmed overlay renders at bottom-4 left-4 with all six sections (Supabase session, PKCE State, sb-* cookies, sb-* localStorage, Recent Sentry breadcrumbs, Recent console errors). Consent state was null (undecided) and overlay still rendered, confirming consent is NOT part of the gate. Screenshot: phase6-uat-fix-test12-debug-overlay.png."
  root_cause: "UAT instruction was wrong — gate is `?debug=auth`, not `?auth_debug=1`. Activation predicate at src/routes/__root.tsx:40-47 reads: new URLSearchParams(window.location.search).get('debug') === 'auth'. Consent state ('allow') is NOT part of the gate. The recent quick-task commit d694d88 (consoleErrors setState bound) only edited the component body, not the activation predicate."
  artifacts:
    - path: "src/routes/__root.tsx:40-47"
      issue: "Gate is `?debug=auth` (correct); UAT script said `?auth_debug=1` (wrong)"
  missing:
    - "Re-run Test 12 with corrected URL: append `?debug=auth` (in dev, that's all you need)"
    - "On production: also set localStorage.wtcs_debug_auth='1' first, then load with ?debug=auth"
    - "Optional code improvement: widen the gate to accept both `?debug=auth` and `?auth_debug=1` aliases for muscle-memory"
  confidence: verified_by_playwright
