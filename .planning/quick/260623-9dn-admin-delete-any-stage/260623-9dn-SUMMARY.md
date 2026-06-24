---
phase: quick-260623-9dn
plan: 01
subsystem: admin-suggestion-crud
tags: [admin, delete, edge-function, rls, d-18-reversal]
status: complete
requires:
  - supabase/migrations/00000000000000_schema.sql (ON DELETE CASCADE FKs on votes/vote_counts/choices)
provides:
  - Always-allowed admin hard delete of suggestions at any lifecycle stage
affects:
  - supabase/functions/delete-poll/index.ts
  - src/components/admin/SuggestionKebabMenu.tsx
  - src/components/admin/DeleteSuggestionDialog.tsx
tech-stack:
  added: []
  patterns:
    - Rely on Postgres ON DELETE CASCADE FKs (no application-level pre-check) for dependent cleanup
key-files:
  created: []
  modified:
    - supabase/functions/delete-poll/index.ts
    - src/components/admin/SuggestionKebabMenu.tsx
    - src/components/admin/DeleteSuggestionDialog.tsx
    - src/__tests__/admin/suggestion-crud-edge.test.ts
    - .planning/PROJECT.md
decisions:
  - "D-18 reversed: admins may delete a suggestion at ANY lifecycle stage (before votes, active with votes, closed); VOTE-03 still holds so only whole-suggestion deletion is possible, not per-vote tampering"
metrics:
  duration: 5m13s
  completed: 2026-06-23
  tasks: 3
  files: 5
---

# Quick 260623-9dn: Admin Delete Any Stage Summary

Reversed the D-18 zero-votes delete lock so admins can hard-delete a suggestion at any lifecycle stage; deletion now cascades to votes and vote_counts via existing FK `ON DELETE CASCADE` with no migration and no individual-vote deletion path.

## What Was Built

- **Task 1 — delete-poll Edge Function:** Removed the `votes` EXISTS 409 pre-check block (`voteRow` / `voteCheckError` / "Cannot delete: responses already received"). Rewrote the header comment to describe always-allowed admin deletion with FK cascade, with no plan/phase/decision IDs. Admin gate (`requireAdmin`), UUID regex, best-effort audit snapshot, `polls` DELETE with PGRST116 → 404, and `poll_deleted` audit all intact. The `votes` table is no longer referenced.
- **Task 2 — Admin UI:** Dropped `deleteDisabled` and all vote-based gating of the Delete kebab item — it is now unconditionally clickable. The Edit lock (`editDisabled`/`hasVotes`) is unchanged (`hasVotes` is still consumed by Edit, so it remains). The confirm dialog copy now warns the suggestion, its choices, and all responses already received are permanently removed and cannot be undone.
- **Task 3 — Tests + docs:** Rewrote the delete-poll describe block to `delete-poll always-allowed admin delete`; removed the three guard-specific tests; added negative assertions that the source no longer references the `votes` table and no longer contains the 409 text. Appended a Key Decisions row to PROJECT.md citing D-18 and VOTE-03.

## Verification

| Check | Result |
| ----- | ------ |
| Task 1 automated grep gate | PASS (no `from('votes')`, no 409 text; requireAdmin + poll_deleted + PGRST116 present) |
| Task 2 `tsc -b` + grep gate | PASS (no `deleteDisabled`, no delete-reason text, dialog warns of responses, no "cannot be deleted") |
| Task 3 vitest gate | PASS (`suggestion-crud-edge.test.ts`: 1 file, 38 tests passed) |
| `npm run lint` (eslint .) | PASS (no errors) |
| PROJECT.md D-18 + VOTE-03 citations | PASS |

No database migration added — FK `ON DELETE CASCADE` on votes/vote_counts/choices already present in `schema.sql` (verified during planning).

## Deviations from Plan

None — plan executed exactly as written. `hasVotes` was retained (still used by the Edit lock), matching the plan's conditional ("may remain if still used by Edit").

## Self-Check: PASSED

- supabase/functions/delete-poll/index.ts — FOUND, no `votes` reference
- src/components/admin/SuggestionKebabMenu.tsx — FOUND, no `deleteDisabled`
- src/components/admin/DeleteSuggestionDialog.tsx — FOUND, response-destructive copy
- src/__tests__/admin/suggestion-crud-edge.test.ts — FOUND, 38 tests pass
- .planning/PROJECT.md — FOUND, D-18 + VOTE-03 row present
- Commits: 0966350 (Task 1), 8fcc6d4 (Task 2), 31f4465 (Task 3) — all in git log
