---
phase: 05-launch-hardening
plan: 02
subsystem: supply-chain
tags: [security, supply-chain, edge-functions, esm-sh, pinning]
requirements: [INFR-02, TEST-06]
threat_model_refs:
  - T-05-03-esm-sh-supplier-compromise
dependency_graph:
  requires:
    - 05-01 (npm-side pin sweep — matched @supabase/supabase-js@2.101.1)
  provides:
    - Exact three-digit esm.sh pins across all 15 Edge Functions + _shared/admin-auth.ts
    - Grep-falsifiable proof surface for D-16 §3
  affects:
    - Every Edge Function cold start (module fetch now resolves deterministic SHA-bound build)
tech-stack:
  added: []
  patterns:
    - 'esm.sh exact-version pin: https://esm.sh/<pkg>@<major>.<minor>.<patch>'
key-files:
  created: []
  modified:
    - supabase/functions/_shared/admin-auth.ts
    - supabase/functions/close-expired-polls/index.ts
    - supabase/functions/close-poll/index.ts
    - supabase/functions/create-category/index.ts
    - supabase/functions/create-poll/index.ts
    - supabase/functions/delete-category/index.ts
    - supabase/functions/delete-poll/index.ts
    - supabase/functions/demote-admin/index.ts
    - supabase/functions/get-upload-url/index.ts
    - supabase/functions/pin-poll/index.ts
    - supabase/functions/promote-admin/index.ts
    - supabase/functions/rename-category/index.ts
    - supabase/functions/search-admin-targets/index.ts
    - supabase/functions/set-resolution/index.ts
    - supabase/functions/submit-vote/index.ts
    - supabase/functions/update-poll/index.ts
decisions:
  - "Pinned to RESEARCH.md Standard Stack versions (supabase-js@2.101.1, ratelimit@2.0.5, redis@1.34.6) rather than CDN-latest (2.103.3 / 2.0.8 / 1.37.0). Per plan directive: `pin-to-current, NOT bump`. A version bump belongs in a separate Dependabot-driven plan with test coverage."
  - "Left transitive rewrites unmitigated (RESEARCH.md Pitfall 8). Stronger defenses (esm.sh/v135 immutable prefix, npm: specifiers + deno.json importmap) are explicitly deferred per RESEARCH §Security Domain."
metrics:
  duration: "~5 min (pure pin sweep)"
  completed: "2026-04-19"
  tasks: 2
  files_modified: 16
---

# Phase 5 Plan 02: esm.sh Pin Sweep Summary

**One-liner:** Pinned every `https://esm.sh/...@<major>` import across 15 Edge Functions plus `_shared/admin-auth.ts` to three-digit exact versions, closing the D-16 §3 supply-chain launch blocker (T-05-03) for the EF tier.

## What Was Done

Replaced floating major-only pins with exact semver pins in 18 import lines across 16 files:

| Package | Old Pin | New Pin | Occurrences |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | `@2` | `@2.101.1` | 16 (all 15 EFs + `_shared/admin-auth.ts`) |
| `@upstash/ratelimit` | `@2` | `@2.0.5` | 1 (`submit-vote`) |
| `@upstash/redis` | `@1` | `@1.34.6` | 1 (`submit-vote`) |

All three version targets match the RESEARCH.md Standard Stack (and align with the npm-side `@supabase/supabase-js@2.101.1` pin set in Plan 05-01).

Relative imports (`../_shared/cors.ts`, `../_shared/admin-auth.ts`) were left untouched — they are project-local, not CDN-sourced.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Verify target pin versions (pin-to-current) | (research-only, no code change) | — |
| 2 | Apply exact three-digit pins to all 16 files | `e2a479c` | 16 EF files |

## Verification

Acceptance criteria (from PLAN Task 2):

- `grep -rE "esm\.sh/[^@]+@[0-9]+'" supabase/functions/` → empty (no bare major-only)
- `grep -rE "esm\.sh/[^@]+@[0-9]+\.[0-9]+'" supabase/functions/` → empty (no major.minor)
- Supabase-js three-digit pin count: **16** (matches target)
- Ratelimit three-digit pin in `submit-vote/index.ts`: **1**
- Redis three-digit pin in `submit-vote/index.ts`: **1**
- `grep -q X-Cron-Secret supabase/functions/close-expired-polls/index.ts` → preserved
- `grep -q requireAdmin supabase/functions/_shared/admin-auth.ts` → preserved

All pass.

### Probe evidence (Task 1)

Live esm.sh probe returned:
- `@supabase/supabase-js@2` → resolved CDN-latest = `2.103.3`
- `@upstash/ratelimit@2` → resolved CDN-latest = `2.0.8`
- `@upstash/redis@1` → resolved CDN-latest = `1.37.0`

Per plan directive ("Do NOT bump to latest if latest > current-resolved. Pin to the version the code was tested against."), the RESEARCH.md Standard Stack defaults were applied instead. A future bump belongs in a Dependabot-driven plan with test coverage.

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues

Lint `npm run lint` produced 7 pre-existing errors in `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/routes/__root.tsx`, `src/routes/auth/callback.tsx`, `src/routes/auth/error.tsx`, `src/routes/index.tsx` (all `react-refresh/only-export-components`). None are in the files modified by this plan. Already catalogued in `.planning/phases/05-launch-hardening/deferred-items.md` under the 05-01 deferrals. Per SCOPE BOUNDARY rule, out of scope for a `supabase/functions/` pin sweep.

## Residual Risks (from plan <security>)

- **T-05-04 (accepted):** esm.sh transitively rewrites deps at request time even with top-level exact pin (Pitfall 8). Acceptable for v1; README §12 (Plan 05-10) will document the upgrade ritual and the esm.sh trust anchor.
- Stronger mitigation (`esm.sh/v135/...` immutable build prefix or `npm:` specifiers + `deno.json` importmap per-function) deferred — labelled "for v1, exact-version pin is acceptable" in RESEARCH.md.

## Threat Mitigation Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-05-03 (esm.sh supplier compromise) | mitigate | DONE — exact three-digit pin across all 16 files |
| T-05-04 (transitive rewrite) | accept | Accepted per RESEARCH; README §12 to document |

## Self-Check: PASSED

Files modified — all 16 present with three-digit pins (grep verified):
- FOUND: all 16 files (supabase-js pin count = 16; ratelimit = 1; redis = 1)

Commit hashes — verified in git log:
- FOUND: `e2a479c` (fix(05-02): pin all esm.sh EF imports to three-digit exact versions)
