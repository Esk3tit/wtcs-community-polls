---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
plan: 01
status: complete
disposition: environmental-finding
date: 2026-04-25
---

# 06-01 — Auth diagnose-first SUMMARY

## Outcome

D-01 instrumentation shipped, D-02 manual repro logged. Bug closed as
**environmental, not a code defect** — Step 0 (Clear site data + reload on
Perplexity Comet Stable) restored a working Discord login flow. No service
workers were registered; the resolving differential was stale browser-side
storage state. Strongest hypothesis (06-RESEARCH.md Pitfall 4) is an
orphaned Supabase `sb-<project-ref>-code-verifier` PKCE artifact, but
without overlay capture against the failing state we cannot confirm. The
overlay still ships per acceptance criteria so any future re-occurrence is
observable on production for an opted-in operator.

## Completed Tasks

| # | Task | Status | Commit | Files |
|---|------|--------|--------|-------|
| 1 | Manual reproduction checklist (D-02) — captured BEFORE any code change | done | `281fe8b` | `06-AUTH-REPRO-LOG.md` |
| 2 | Sentry breadcrumbs across the auth lifecycle (D-01) | done | `a72528c` | `AuthContext.tsx`, `auth-helpers.ts`, `routes/auth/callback.tsx`, `AuthErrorPage.tsx` |
| 3 | `?debug=auth` diagnostic overlay + R-01 multi-condition gate | done | `b284b6f` | `components/debug/DebugAuthOverlay.tsx` (new), `routes/__root.tsx` |
| 4 | Disposition + activation-key cleanup (human-verify gate) | done | this commit | `06-AUTH-REPRO-LOG.md` |

## What was built

- **18 Sentry breadcrumbs** across the auth lifecycle, all `category: 'auth'`,
  six-key constraint honored, no raw tokens or PII in `data` payloads:
  - 3 in `AuthContext` (mount, getSession resolved, onAuthStateChange dispatch)
  - 12 in `auth-helpers` (one per `handleAuthCallback` rejection branch)
  - 2 in `callback` route (mount, resolution)
  - 1 in `AuthErrorPage` (`useEffect` — zero DOM diff vs. pre-Phase-6)
- **`DebugAuthOverlay`** — read-only diagnostic card anchored bottom-left,
  six sections (Supabase session with truncated tokens, PKCE State row that
  surfaces `MISSING — no sb-*-code-verifier` when absent, sb-* cookies,
  sb-* localStorage, last 5 Sentry breadcrumbs, last 30s of console errors).
  Each section has a Copy-to-clipboard affordance (Sonner toast feedback).
  Manual dismiss via X. Console.error proxy is restored on unmount.
- **R-01 production-reachability gate** in `__root.tsx`:
  ```
  (localStorage.wtcs_debug_auth === '1' || import.meta.env.DEV)
    && ?debug=auth
  ```
  Lazy-loaded via `lazy()` + `Suspense` — Rolldown emits a separate
  `DebugAuthOverlay-*.js` chunk (6.26 kB raw / 1.95 kB gzipped). The chunk
  ships in the production bundle (intentional R-01 tradeoff so the overlay
  is reachable in the failing browser), but its render requires an explicit
  per-browser DevTools opt-in.

## Verification

- Lint clean (zero warnings, zero errors).
- 357/357 tests pass.
- `npm run build` succeeds; DebugAuthOverlay code-split into its own chunk.
- All Task 2 grep AC met (3 / 12 / 2 / 1 breadcrumb counts; no `level: 'error'`;
  no raw tokens; AuthErrorPage JSX byte-identical).
- All Task 3 grep AC met (width lock, anchor lock, dismiss aria-label, token
  truncation `slice(0, 8)`, PKCE State heading, code-verifier scan, MISSING
  copy, single render site in `__root.tsx`).
- T-06-19 satisfied by absence — `wtcs_debug_auth` was never set on any
  browser during this plan (Step 0 PASS made overlay capture unnecessary);
  spot-check on Perplexity Comet confirmed `localStorage.getItem('wtcs_debug_auth')`
  returns `null`.

## Deviations from Plan

**[Rule 1 — AC coherence] Reorder of `__root.tsx` render-gate operands**
- **Found during:** Task 3 verification.
- **Issue:** Task 3 `<action>` block instructs paste-verbatim of
  `(import.meta.env.DEV || window.localStorage.getItem('wtcs_debug_auth') === '1')`,
  but the corresponding Task 3 `<acceptance_criteria>` line uses
  `grep -A 4 "wtcs_debug_auth" src/routes/__root.tsx | grep -c "import.meta.env.DEV"`
  which only counts `import.meta.env.DEV` occurrences in the **4 lines AFTER**
  the `wtcs_debug_auth` line. With DEV first the AC grep returned 0 (false-fail).
- **Fix:** swapped the OR operand order to
  `(window.localStorage.getItem('wtcs_debug_auth') === '1' || import.meta.env.DEV)`.
  Semantically identical (commutative `||`); same render behavior; AC grep
  now returns 1 as intended.
- **Files modified:** `src/routes/__root.tsx`.
- **Verification:** AC grep returns 1; lint + tests + build still pass.
- **Commit hash:** `b284b6f` (folded into Task 3's commit since the deviation
  surfaced during the same edit).

**Total deviations:** 1 auto-fixed (1 AC-coherence). **Impact:** none on
behavior or security; resolves a plan internal inconsistency.

## Issues Encountered

- One pre-existing project-level Vite/Rolldown chunk-size warning fires on
  the main `index-*.js` bundle (>500 kB). Unrelated to this plan; not
  introduced by 06-01. No action.
- Husky `pre-commit` hook is not executable (`fs::stat` advisory); commits
  succeed. Not a 06-01 concern; flagged for any future plan that wants to
  fix the hook permission.

## Carry-forward

- **For 06-02b:** Phase 6 GDPR opt-IN rewire will replace the legacy
  `analytics_opted_out` localStorage flag (still referenced in
  `ConsentChip.tsx` and `sentry.ts`) with the new `wtcs_consent` key.
  AuthContext's `posthog.identify()` call (line ~116) currently fires
  unconditionally; 06-02b moves it into its own dedicated effect gated on
  consent === 'allow' (R-03 split).
- **For verifier:** if the auth bug recurs in any browser, the operator
  flow is now: open DevTools → `localStorage.setItem('wtcs_debug_auth','1')`
  → reload → visit `/?debug=auth` → capture the six sections. Disposition
  log section "## Activation Key Cleared" must be re-filled when done.

## Authentication Gates

None encountered.
