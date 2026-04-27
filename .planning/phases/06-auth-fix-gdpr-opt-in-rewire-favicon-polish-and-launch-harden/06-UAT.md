---
status: partial
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
  status: failed
  reason: "User reported: Allow click + chip appearance both work, but no PostHog network requests visible after accepting and navigating different tabs"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Sentry breadcrumb fires on AuthErrorPage useEffect"
  status: failed
  reason: "User reported: sentry doesn't fire for the error page"
  severity: major
  test: 11
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
  related_issue: "Possibly overlaps with known issue #17 (Sentry React SDK v10 + React 19 ErrorBoundary path) — verify whether AuthErrorPage useEffect breadcrumb path is affected by the same root cause"

- truth: "DebugAuthOverlay renders when ?auth_debug=1 with analytics consent allowed"
  status: failed
  reason: "User reported: no diagnostic card appeared with anonymous usage analytics turned on"
  severity: major
  test: 12
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
