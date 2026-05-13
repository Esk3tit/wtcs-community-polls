---
phase: 07-observability-hardening
fixed_at: 2026-04-30T21:40:01Z
review_path: .planning/phases/07-observability-hardening/07-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-04-30T21:40:01Z
**Source review:** .planning/phases/07-observability-hardening/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Critical 0, Warning 4)
- Fixed: 4
- Skipped: 0

All four warnings (WR-01 .. WR-04) applied surgically. Each fix passes
`tsc -b --noEmit` + `eslint --max-warnings 0` (enforced by lint-staged
pre-commit hook). End-to-end `npm run build` succeeds.

Info findings (IN-01 .. IN-05) are out of scope (`fix_scope:
critical_warning`) and remain documented in 07-REVIEW.md for follow-up.

## Fixed Issues

### WR-01: `mechanism.handled` mis-tagged for uncaught React errors

**Files modified:** `src/main.tsx`
**Commit:** 5960565
**Applied fix:** Pass `undefined` callback to `Sentry.reactErrorHandler`
for the `uncaught` kind so `mechanism.handled = !!callback` resolves to
`false`. `caught` and `recoverable` keep an additive no-op callback so
they continue to flag `handled=true`. The dev-warn moved outside
`reactErrorHandler` so logging still fires for uncaught errors.

This unblocks Sentry's release-health crash-free-sessions metric (uncaught
events now correctly count against the metric) and corrects the
handled/unhandled UI badge per Sentry's mechanism semantics.

The ESLint rule `@typescript-eslint/no-unused-vars` does not honor `_`
prefix in this project's config — the no-op callback was simplified from
`(_err, _errInfo) => {}` to `() => {}` to satisfy the linter. Same
runtime behavior; Sentry's reactErrorHandler will pass three arguments
that we ignore.

### WR-02: Triple-capture for one render-phase throw — Dedupe is the only line of defense

**Files modified:** `src/main.tsx`
**Commit:** f80336e
**Applied fix:** Explicitly add `Sentry.dedupeIntegration()` to the
`integrations` array. Sentry's `defaultIntegrations` includes Dedupe
implicitly, but pinning it makes the contract auditable and protects
against silent removal in a future SDK upgrade.

Chose the lower-risk option from REVIEW.md (option 2: pin Dedupe). Option 1
(drop the `onError` belt) was rejected as more behaviorally invasive — the
existing belt comment in `src/main.tsx:104-111` documents it as
defense-in-depth fallback "in case dedup removes the SDK event instead",
so removing it would discard explicit defense-in-depth without empirical
data on which path Dedupe actually keeps.

This fix is structural (registers the integration) and does not alter the
capture flow itself. Combined with the WR-01 fix, the deduped event will
now report the correct `mechanism.handled` value.

**Note:** Logic correctness here depends on Sentry SDK behavior, but the
change itself is mechanical (adding a documented public API integration).
No human verification needed beyond the build pass.

### WR-03: Empty-string `VITE_NETLIFY_CONTEXT` defeats the nullish-coalesce fallback

**Files modified:** `src/main.tsx`
**Commit:** c9475b8
**Applied fix:** Switched `environment: VITE_NETLIFY_CONTEXT ?? MODE` to
`environment: VITE_NETLIFY_CONTEXT || MODE`. Empty strings (produced by
`VITE_NETLIFY_CONTEXT=$CONTEXT` when `$CONTEXT` is unset on misconfigured
deploys or non-Netlify CI re-using netlify.toml) now fall through to
`import.meta.env.MODE` instead of being forwarded to Sentry as
`environment: ""`.

`netlify.toml` was intentionally NOT edited. REVIEW.md offered hardening
the build command with `[ -n "$CONTEXT" ] &&` as an alternative, but the
minimal mechanical fix lives in `src/main.tsx` and avoids touching the
deploy flow — fail-fast on missing `$CONTEXT` would block legitimate
local `netlify deploy --build` runs without Netlify env wiring.

### WR-04: `validateSearch` uses lossy `String()` coerce — accepts non-string `render` values

**Files modified:** `src/routes/[__smoke].tsx`
**Commit:** 840f0ac
**Applied fix:** Replaced `String(search.render) === '1'` with explicit
equality `r === '1' || r === 1`. Covers both forms TanStack Router's
`parseSearchWith(JSON.parse)` produces (string `'1'` for raw URL value,
number `1` for JSON-parsed URL value) and rejects coercion edge cases
(`[1]`, `{ toString: () => '1' }`).

Validator now matches the declared `SmokeSearch` type narrowly; debug-only
prod-gated route, so security impact remains negligible, but the
validator is no longer laxer than its declared type.

---

_Fixed: 2026-04-30T21:40:01Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
