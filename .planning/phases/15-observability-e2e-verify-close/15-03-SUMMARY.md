---
plan: 15-03
phase: 15-observability-e2e-verify-close
status: complete
commit: 684797e
---

## Objective

Wire `scripts/verify-sourcemap-names.mjs` into the `lint-and-unit` job in `.github/workflows/ci.yml`.

## Case Determination

**Case A applied.** Probe with `env -u SENTRY_AUTH_TOKEN -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY npm run build` exited 0. Although `src/lib/supabase.ts` throws at browser runtime when env vars are absent, Vite inlines the values at build time and the TypeScript/Rolldown compilation succeeds regardless. No `env:` block needed on the build step.

## Changes Made

**File:** `.github/workflows/ci.yml`

Two steps inserted into the `lint-and-unit` job, after `npm test -- --run` and before `npm audit (non-blocking)`:

```yaml
# D-08 / OBSV-04(a) — build solely to produce dist/ for the verify step
# below; no Supabase env vars needed (build succeeds with them unset,
# throw fires at browser runtime only). SENTRY_AUTH_TOKEN intentionally
# absent — sourcemap upload is a Netlify-build concern, not a CI concern.
- name: Build (for sourcemap-names verify)
  run: npm run build
- name: Verify sourcemap function names preserved
  run: node scripts/verify-sourcemap-names.mjs
```

## Diff Scope

`git diff` showed 8 insertions, 0 deletions, scoped entirely to the `lint-and-unit` job block. No changes to the `e2e` job, `test-integration` job, `lint` step, `npm test -- --run` step, or `npm audit` step.

## Acceptance Criteria Results

| Check | Result |
|-------|--------|
| `npm run build` in lint-and-unit region (awk slice) | 1 (PASS) |
| `verify-sourcemap-names.mjs` in lint-and-unit region | 1 (PASS) |
| Combined count >= 2 (automated verify) | PASS |
| D-08 citation present | 1 (PASS) |
| OBSV-04 citation present | 1 (PASS) |
| SENTRY_AUTH_TOKEN NOT added to lint-and-unit | 0 (PASS) |
| YAML no-tabs check | PASS |
| YAML python3 yaml.safe_load | skipped (no pyyaml) — node-based check passed |

## Local Dry-Run

```
npm run build  →  exit 0
node scripts/verify-sourcemap-names.mjs  →  OK: 38 chunk(s) scanned, 7/7 allowlisted names found
verify exit:  0
```

## Commit

`684797e` — `feat(ci): wire sourcemap-names verify into lint-and-unit job (15-03, OBSV-04)`
