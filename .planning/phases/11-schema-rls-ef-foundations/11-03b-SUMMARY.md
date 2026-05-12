---
phase: 11-schema-rls-ef-foundations
plan: 03b
subsystem: edge-functions
tags: [audit, retrofit, edge-function, results-hidden, supabase]
requirements-completed:
  - "VIS-02 (partial — 12/13 emitters live after this plan; combined with Plan 02 and Plan 11-03)"
  - "D-08 (create-poll accepts optional results_hidden boolean body field)"
  - "D-09 (two audit rows emitted on results_hidden=true at create)"
  - "D-10 (default false; column DEFAULT carries the common path)"
dependency-graph:
  requires:
    - 11-01 (polls.results_hidden + polls.results_hidden_changed_at columns with DEFAULT false)
    - 11-02 (writeAudit helper + AuditEntry type)
    - 11-03 (11 audit retrofits — establishes the audit-emitter pattern this plan extends)
  provides:
    - "12th audit emitter (create-poll → poll_created always; results_hidden_set_at_create on true path)"
    - "Live results_hidden body acceptance on create-poll (D-08/D-09/D-10 contract)"
  affects:
    - "Plan 11-04 (TEST-12 surface — flagged below as 'Open follow-ups': fifth integration case for the results_hidden=true create path)"
    - "Plan 11-05 (deploy gate — create-poll already in the 12-EF deploy enumeration; no change to Plan 05 task list required)"
tech-stack:
  added: []
  patterns:
    - "Option A locked: post-RPC conditional UPDATE on results_hidden=true. RPC signature unchanged; column DEFAULT covers the common path"
    - "Compensating DELETE on UPDATE failure preserves all-or-nothing semantics from the caller's perspective"
    - "Two audit rows on the true-path: poll_created (always) + results_hidden_set_at_create (gated). Both emitted AFTER the UPDATE succeeds (audit reflects final row state)"
    - "Strict boolean validation: undefined → false, boolean → as-is, anything else → 400 'Invalid results_hidden' (no coercion)"
key-files:
  created: []
  modified:
    - supabase/functions/create-poll/index.ts
decisions:
  - "Local variable name is `results_hidden` (snake_case) matching the DB column and request body field name. JS/TS conventions normally favor camelCase, but the plan body locks snake_case explicitly so the variable, the request field, and the column are textually identical at the audit-payload and SQL boundary."
  - "Used `new Date().toISOString()` for the `results_hidden_changed_at` stamp inside the UPDATE object (rather than raw SQL `now()`). The supabase-js update API does not interpret SQL functions inside object values; an ISO string is the correct shape and is deterministic from the EF's perspective."
  - "Compensating DELETE filter is by id only — `.from('polls').delete().eq('id', pollId)`. The CASCADE on `choices` and `vote_counts` cleans those up; no need to explicitly target child tables."
  - "Audit rows are emitted ONLY AFTER the post-RPC UPDATE succeeds. On compensation, neither audit row is written (the poll never existed from the caller's perspective), preserving the audit log as a reliable record of state actually applied."
metrics:
  duration: 4 minutes (validation + 6-step retrofit + lint + tests + 1 atomic commit)
  completed: 2026-05-11
---

# Phase 11 Plan 03b: create-poll Audit Retrofit + results_hidden Extension Summary

**One-liner:** Extended `create-poll` to accept optional `results_hidden: boolean` body field (D-08/D-10) and emit two audit rows on the opt-in-hidden path (D-09) — completing the 12th of 13 audit emitters; RPC signature and migration 10 untouched (Option A locked).

## What shipped

`supabase/functions/create-poll/index.ts` now:

1. Imports `writeAudit` from `_shared/audit.ts` (shared helper from Plan 02).
2. Accepts a new optional body field `results_hidden?: boolean`:
   - `undefined` → resolves to `false` (column DEFAULT carries it through the RPC).
   - `boolean` → resolved value used downstream.
   - Anything else → 400 with `{ error: 'Invalid results_hidden' }` (no coercion).
3. Calls the existing `create_poll_with_choices` RPC with the **unchanged** 7-argument shape. The new poll row inserts with `results_hidden = false` from the migration-10 column DEFAULT.
4. On `results_hidden === true`: runs a post-RPC UPDATE on the `polls` row (`results_hidden: true`, `results_hidden_changed_at: now()` ISO) via the service-role client. On UPDATE failure: runs a compensating DELETE on the same poll row + returns HTTP 500 `{ error: 'Failed to set results_hidden — poll creation rolled back. Retry.' }`. The CASCADE in migration 0 cleans up `choices` and any `vote_counts` rows.
5. Emits the `poll_created` audit row on every success path with `before: null`, `after: { title, category_id, results_hidden }` (the resolved boolean — `true` when the bootstrap UPDATE succeeded, `false` otherwise).
6. Emits a second `results_hidden_set_at_create` audit row **only** when `results_hidden === true` (gated by the same predicate as the post-RPC UPDATE), with `before: null`, `after: { results_hidden: true }`.
7. Response shape is byte-for-byte unchanged on success: `HTTP 200 { success: true, id: pollId }`.

| action | target_type | actor_id | target_id | before | after | when emitted |
|--------|-------------|----------|-----------|--------|-------|--------------|
| `poll_created` | `poll` | `user.id` | `pollId` (RPC return, string UUID) | `null` | `{ title, category_id, results_hidden }` | ALWAYS on success |
| `results_hidden_set_at_create` | `poll` | `user.id` | same `pollId` | `null` | `{ results_hidden: true }` | ONLY when body `results_hidden === true` |

## Commits

| Plan task | Commit |
|-----------|--------|
| 03b-01 create-poll results_hidden extension + audit retrofit | `4add7ec` |

## Verification (acceptance criteria + automated checks)

All 17 acceptance criteria from the plan body verified:

- **AC1:** `import { writeAudit } from '../_shared/audit.ts'` — present (line 6).
- **AC2:** `typeof body.results_hidden === 'boolean'` check present + 400 path with literal message `'Invalid results_hidden'` — both present.
- **AC3:** `.update({ results_hidden: true, results_hidden_changed_at: ... })` — `results_hidden_changed_at` appears inside the `.update(` call shape.
- **AC4:** The `.update(` lives inside `if (results_hidden === true) { ... }` — verified with POSIX awk (`\s` in plan verify is a portability quirk; intent satisfied).
- **AC5:** Exactly **2** `await writeAudit(` calls — confirmed via `grep -c`.
- **AC6:** Exactly **1** `action: 'poll_created'` AND exactly **1** `action: 'results_hidden_set_at_create'` — confirmed.
- **AC7:** Gating `if (results_hidden === true)` appears within 5 lines above the second `writeAudit` — confirmed via `grep -B 5`.
- **AC8:** RPC signature UNCHANGED — `grep -qE "create_poll_with_choices[^)]*results_hidden"` returns NO match (the negative guard).
- **AC9:** Migration 10 file untouched — `git diff` shows no delta on `supabase/migrations/00000000000010_results_hidden_audit.sql`.
- **AC10:** Success response shape `{ success: true, id: pollId }` preserved; `{ poll: <row> }` shape never introduced.
- **AC11:** Local variable name is `pollId` (matches live EF destructuring); `newPollId` count = 0.
- **AC12:** No try/catch wraps either `writeAudit` (Pitfall 3 fail-open responsibility belongs to the helper).
- **AC13:** Compensating DELETE present: `.from('polls').delete().eq('id', pollId)`.
- **AC14:** Compensation DELETE is gated on `updateError` (only runs when UPDATE failed) — confirmed via awk.
- **AC15:** 500 response on compensation path contains `'poll creation rolled back'`.
- **AC16:** Hidden-at-create action string is `results_hidden_set_at_create` (NOT `..._at_creation`). Count of `_at_creation` = 0.
- **AC17:** No review-round / phase-ID archaeology in source — all inline comments are pure WHY, no `Round N` / `Plan N-N` / `PR #N` / `REVIEW-FIX-` / `BLOCKER-` / `D-NN` mentions.

**Build/test gates:**
- `npm run lint` — exits 0, no new warnings (pre-commit hook re-ran with same result).
- `npm run test` — 41 test files, **389/389** passing (baseline preserved).
- Pre-commit hook `tsc -b --noEmit` — clean.
- `git diff --stat` for the commit: 1 file changed, **54 insertions(+), 0 deletions(-)** — squarely in the plan's 35–55 line guidance.

## Deviations from Plan

**None.** The plan body was followed precisely. Two notes:

- The plan body's `verify` awk regex uses `\s` shorthand which is not portable across mawk/gawk; the AC4 intent (`.update(` inside the `if (results_hidden === true)` block) is satisfied and was verified with the POSIX `[[:space:]]*` form. The semantic check passes.
- All inline comments in the EF are WHY-only, with no plan/round/review-tag mentions (CLAUDE.md memory `feedback_no_review_archaeology_in_source.md`).

## Threat Flags

None — the retrofit introduces no new network surface, auth path, file access pattern, or schema change. The post-RPC UPDATE writes to an existing column added by migration 10; both audit rows go into the existing `audit_log` table; the compensating DELETE acts on the same row id the RPC just returned.

## Known Stubs

None. All audit fields are wired to live request data and the RPC's returned `pollId`. The `before: null` literal for both audit rows is the locked contract from PATTERNS.md (D-07: pre-RPC state has no pre-existing row, so `null` is the only correct value).

## Open follow-ups

- **TEST-12 surface in Plan 11-04:** The plan body explicitly defers runtime verification to Plan 04. The four currently-planned TEST-12 integration cases cover the `toggle-results-visibility` EF surface; **a fifth integration case is recommended** to assert the `create-poll → { results_hidden: true }` path produces both audit rows (`poll_created` with `after.results_hidden === true` AND `results_hidden_set_at_create` with `after.results_hidden === true`) AND that the polls row has `results_hidden = true` + non-null `results_hidden_changed_at`. Plan 04's `depends_on` already lists this plan; the new case can reuse `createFreshPoll` (extended to accept `results_hidden: true`) + `readAuditLog` helpers from Plan 00.
- Plan 11-05's deploy enumeration already includes `create-poll` (no change to Plan 05 task list needed); the 12-EF deploy loop covers this retrofit.

## Self-Check: PASSED

- File `supabase/functions/create-poll/index.ts` modified and committed in `4add7ec` — `[ -f supabase/functions/create-poll/index.ts ] && echo FOUND` → FOUND.
- Commit `4add7ec` present in `git log --oneline` — FOUND.
- All 17 plan-body acceptance criteria green (see Verification section above).
- `npm run lint` exits 0 — VERIFIED.
- `npm run test` 389/389 — VERIFIED.
- `git diff --stat` shows ONLY `supabase/functions/create-poll/index.ts` modified (no spillover into other EFs, migrations, or planning artifacts).
- Migration 10 untouched (`git diff --name-only HEAD -- supabase/migrations/00000000000010_results_hidden_audit.sql` empty).
