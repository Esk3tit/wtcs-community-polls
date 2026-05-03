---
phase: 08-e2e-test-hygiene
plan: "03"
subsystem: e2e-specs
tags:
  - e2e
  - playwright
  - eslint
  - migration
dependency_graph:
  requires:
    - 08-01 (poll-fixture.ts — freshPoll fixture)
    - 08-02 (E2E-SCOPE-1 lint rule in eslint.config.js)
  provides:
    - Four spec files rule-compliant with E2E-SCOPE-1
    - browse-respond.spec.ts: proof-of-contract freshPoll consumer
    - filter-search.spec.ts: inline-filter migration (AST-safe, no cards alias)
  affects:
    - e2e/tests/browse-respond.spec.ts
    - e2e/tests/filter-search.spec.ts
    - e2e/tests/admin-create.spec.ts (verified, no edit)
    - e2e/tests/auth-errors.spec.ts (verified, no edit)
tech_stack:
  added: []
  patterns:
    - "eslint-disable-next-line no-restricted-syntax -- DOM-scoped WHY comment (escape-hatch b)"
    - "Inline .filter() per chain expression (escape-hatch a per REVIEWS R-1)"
key_files:
  created: []
  modified:
    - e2e/tests/browse-respond.spec.ts
    - e2e/tests/filter-search.spec.ts
decisions:
  - "browse-respond.spec.ts uses escape-hatch (b) at L35+L44: DOM-scoped locators inside firstCard already narrow to one element — eslint-disable-next-line preserves legibility"
  - "filter-search.spec.ts uses escape-hatch (a): inline .filter({ hasText: /[E2E]/ }) on every chain — removes const cards alias that would false-positive the AST selector (REVIEWS R-1)"
  - "admin-create.spec.ts and auth-errors.spec.ts require zero source edits — confirmed lint-clean against E2E-SCOPE-1"
  - "Playwright runs deferred to user per orchestrator instruction (local Supabase stack unavailable in this worktree)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-02"
  tasks_completed: 3
  tasks_total: 4
  files_modified: 2
  files_verified_unchanged: 2
---

# Phase 8 Plan 03: Spec Migration (TEST-07/08/09) Summary

Migrated four Playwright spec files to clear the E2E-SCOPE-1 lint rule (Plan 02) and consume the freshPoll fixture (Plan 01). After this plan, `npm run lint` exits 0 across all four specs; freshPoll is wired as the proof-of-contract consumer in browse-respond.spec.ts.

## Tasks Completed

| Task | Spec | Action | Commit | Lines +/- |
|------|------|--------|--------|-----------|
| 1 | browse-respond.spec.ts | Fixture migration + regex tighten + 2 eslint-disables | `184b8f5` | +10 / -5 |
| 2 | filter-search.spec.ts | Inline-filter migration (const cards removed) | `9e809fc` | +20 / -6 |
| 3 | admin-create.spec.ts | Verify only — zero source edits | (no commit) | 0 / 0 |
| 3 | auth-errors.spec.ts | Verify only — zero source edits | (no commit) | 0 / 0 |
| 4 | — | Human checkpoint — awaiting user verification | — | — |

## Per-Spec Changes

### Task 1: browse-respond.spec.ts (commit `184b8f5`)

Six edits applied:

1. **Import swap**: `@playwright/test` → `../fixtures/poll-fixture`
2. **Test signature**: added `freshPoll` destructure
3. **firstCard binding**: replaced `.first()` with `.filter({ hasText: freshPoll.title }).first()` (escape-hatch a)
4. **Disable at L35**: `eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; only one collapsed trigger exists.`
5. **Disable at L44**: `eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; .first() picks the first choice button.`
6. **Regex tighten**: `/\d+\s+total response/i` → `/[1-9]\d*\s+total response/i` (rules out zero-vote false positive)

Mitigation chosen: **escape-hatch (b)** for L35/L44 — `firstCard` is already DOM-scoped to the fixture-specific card via the title filter; `.first()` calls inside it cannot reach non-fixture rows.

### Task 2: filter-search.spec.ts (commit `9e809fc`)

Three edits applied (inline-filter approach — REVIEWS R-1 mitigation a):

1. **Baseline block**: removed `const cards = page.getByTestId(...)` alias; replaced with two inline-filter calls (visible assertion + initialCount)
2. **filteredCount**: replaced `await cards.count()` with inline chain
3. **toHaveCount assertion**: replaced `expect(cards).toHaveCount(1)` with inline chain

Result: 4 occurrences of `.filter({ hasText: /\[E2E\]/ })` — one per list-locator call expression. The Sinai filter (L51) and SMOKE search token (L73) are unchanged.

Mitigation chosen: **escape-hatch (a)** — no variable aliasing; AST selector sees `.filter()` in every chain that calls `.first()/.count()/.toHaveCount()`.

### Task 3: admin-create.spec.ts + auth-errors.spec.ts (no commit)

Both files confirmed lint-clean against E2E-SCOPE-1 with zero source modifications:
- `admin-create.spec.ts`: no list-count assertions; uses `.getByText(uniqueTitle)` which is not a multi-element counter/indexer
- `auth-errors.spec.ts`: no matched call sites (no `.first()/.nth()/.last()/.all()/.toHaveCount()`)

## Verification Gates

| Gate | Status | Notes |
|------|--------|-------|
| `grep: fixture import` (browse-respond) | PASS | `../fixtures/poll-fixture` present |
| `grep: freshPoll destructure` | PASS | `async ({ page, freshPoll })` |
| `grep: filter by title` | PASS | `.filter({ hasText: freshPoll.title })` |
| `grep: tightened regex` | PASS | `/[1-9]\d*\s+total response/i` |
| `grep: old regex gone` | PASS | `\d+\s+total response` absent |
| `grep: exactly 2 disable comments` | PASS | count = 2 |
| `grep: old playwright import gone` | PASS | `@playwright/test` absent |
| `grep: no new rot tags` | PASS | no Phase 8 / TEST-0x / issue # in new lines |
| `grep: ≥3 inline filters` (filter-search) | PASS | count = 4 |
| `grep: E2E-SCOPE-1 comment present` | PASS | |
| `grep: no const cards alias` | PASS | alias removed |
| `grep: Sinai filter unchanged` | PASS | |
| `grep: SMOKE search unchanged` | PASS | |
| `eslint browse-respond.spec.ts` | PASS | exit 0 |
| `eslint filter-search.spec.ts` | PASS | exit 0 |
| `eslint admin-create.spec.ts` | PASS | exit 0 |
| `eslint auth-errors.spec.ts` | PASS | exit 0 |
| `eslint e2e/tests/` (all 4 specs) | PASS | exit 0 |
| Synthetic canary fires on violation | PASS | rule fires on unfiltered `.first()` |
| Alias canary fires (AST blind spot) | PASS | rule fires on variable-aliased locator |
| WHY-only rot-tag guard | PASS | no new Phase 8/TEST/issue markers in diff |
| `git diff admin-create + auth-errors = 0` | PASS | no source edits |
| `npx playwright test ... --grep @smoke` | DEFERRED | See note below |

**Playwright deferred to user per orchestrator instruction**: local Supabase stack is not available in this worktree. The user will run the full smoke suite as part of Task 4's human-checkpoint verification.

## Deviations from Plan

None — plan executed exactly as written for Tasks 1–3. The per-spec atomic commit protocol (REVIEWS R-2) is followed: Task 1 and Task 2 each committed before the next task started. Task 3 produced no source edits (as expected per RESEARCH §2a and §4), so no Task 3 commit was needed.

## Requirements Satisfied

| Requirement | Gate | Status |
|-------------|------|--------|
| TEST-07 | `eslint e2e/tests/` exit 0 + specs pass @smoke | Lint PASS; Playwright deferred |
| TEST-08-rule-quiet | `eslint e2e/tests/` exit 0 | PASS |
| TEST-08-rule-fires | Synthetic canary fires | PASS |
| TEST-09-consumer | browse-respond imports freshPoll + filter | PASS |
| TEST-09-cleanup | freshPoll teardown in fixture (Plan 01) | PASS (Plan 01 artifact) |

## Task 4 Status: Awaiting Human Verification

Task 4 is a `checkpoint:human-verify` gate. It is unblocked — all four spec files lint clean and the fixture/rule artifacts (Plans 01+02) are in place.

To complete Task 4, run the following in a shell with a live local Supabase stack:

```bash
supabase stop || true && supabase start
# Apply e2e fixture seed
PGOPTIONS='-c app.e2e_seed_allowed=true' \
  psql "$(supabase status --output json | jq -r '.DB_URL')" \
  -f e2e/fixtures/seed.sql
# Export env vars
export VITE_SUPABASE_URL="$(supabase status --output json | jq -r '.API_URL')"
export VITE_SUPABASE_ANON_KEY="$(supabase status --output json | jq -r '.ANON_KEY')"
export SUPABASE_SERVICE_ROLE_KEY="$(supabase status --output json | jq -r '.SERVICE_ROLE_KEY')"
# Lint + smoke suite
npm run lint
npm run e2e -- --grep @smoke
# Fixture leak check
psql "$(supabase status --output json | jq -r '.DB_URL')" \
  -c "select count(*) from polls where description = 'freshPoll fixture row' and created_at > now() - interval '5 minutes'"
```

Expected: lint exit 0, 4 specs / 4 passed, leak count = 0. Then push and confirm CI green before approving.

See Plan 04 (TEST-10 runbook + UAT-10 append) for the parallel track — it is not blocked by Task 4's outcome.

## Self-Check: PASSED

- `e2e/tests/browse-respond.spec.ts` exists and has correct content (verified post-edit)
- `e2e/tests/filter-search.spec.ts` exists and has correct content (verified post-edit)
- Commit `184b8f5` exists (Task 1)
- Commit `9e809fc` exists (Task 2)
- All lint gates passed
- No STATE.md or ROADMAP.md modifications made (orchestrator owns these)
