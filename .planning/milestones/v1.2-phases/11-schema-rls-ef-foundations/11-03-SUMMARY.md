---
phase: 11-schema-rls-ef-foundations
plan: 03
subsystem: edge-functions
tags: [audit, retrofit, edge-function, supabase]
requirements-completed: [VIS-02 (partial — combined with Plan 02 and Plan 11-03b)]
dependency-graph:
  requires:
    - 11-02 (writeAudit shared helper + AuditEntry type)
    - 11-01 (audit_log table + target_id text + indexes)
  provides:
    - 11 retrofitted audit emitters (12 of 13 total surface after Plan 11-03b lands create-poll)
  affects:
    - Plan 11-03b (create-poll retrofit completes the 13-emitter floor)
    - Plan 11-04 (TEST-12 audit-row assertions exercise the toggle EF; full surface verified at deploy)
    - Plan 11-05 (deploy gate — `supabase functions deploy <name>` for each retrofitted EF)
tech-stack:
  added: []
  patterns:
    - "Post-mutation audit emission (insert one writeAudit call after the success check, before the success return)"
    - "Cron-actor exception: actor_id=null for system-driven state changes (close-expired-polls)"
    - "Best-effort pre-fetch via maybeSingle() for DELETE/UPDATE EFs to capture before-snapshot without changing existing 404 envelope"
    - "Two-branch promote-admin: admin_preauthorized keyed on Discord snowflake (target_type=admin_discord_ids) plus 0..N admin_promoted rows in the retroactive flip loop"
    - "23505 idempotent path skips its own audit row (mirrors D-11 no-op-no-audit)"
key-files:
  created: []
  modified:
    - supabase/functions/close-expired-polls/index.ts
    - supabase/functions/close-poll/index.ts
    - supabase/functions/create-category/index.ts
    - supabase/functions/delete-category/index.ts
    - supabase/functions/delete-poll/index.ts
    - supabase/functions/demote-admin/index.ts
    - supabase/functions/pin-poll/index.ts
    - supabase/functions/promote-admin/index.ts
    - supabase/functions/rename-category/index.ts
    - supabase/functions/set-resolution/index.ts
    - supabase/functions/update-poll/index.ts
decisions:
  - "Used 11 atomic commits (one per EF) to maximize bisect granularity. Each commit is independently revertible without touching other EFs."
  - "For 4 EFs that did not already SELECT before their mutation (delete-category, delete-poll, rename-category, set-resolution), introduced a `maybeSingle()` best-effort pre-fetch instead of `single()`. Rationale: `maybeSingle` does NOT error on miss, so the subsequent UPDATE/DELETE remains the canonical 404 source — the existing PGRST116 error envelope is preserved exactly. When the pre-fetch returns null, the audit `before` falls back to `{id}` per the plan body's escape hatch."
  - "For update-poll (RPC-based), `before` is `null` (per D-07 — RPC does not return prior values; pre-read SELECT would double round-trip cost without forensic gain). `after` carries the full request body field set the RPC mutated: `{title, description, category_id, image_url, closes_at, choices}`."
  - "promote-admin Branch 2 retroactive flip uses sequential `await` inside the for-loop (matches close-expired-polls cron discipline). The 23505 idempotent path skips `admin_preauthorized` — guarded by `if (insertError === null) { ... }` — but the retroactive flip still runs unconditionally and audits any newly flipped profile rows."
metrics:
  duration: 6 minutes (audit retrofit + lint + tests + 11 atomic commits)
  completed: 2026-05-11
---

# Phase 11 Plan 03: Audit Retrofit (11 EFs) Summary

**One-liner:** Retrofitted 11 existing admin Edge Functions with `writeAudit(...)` calls — one audit row per state-changing path, locked per-EF action strings, no response-shape changes, no try/catch wraps around the fail-open helper.

## What shipped

This plan brings 11 of the 13 v1.2 audit emitters live. Combined with Plan 02 (the `toggle-results-visibility` EF) and the pending Plan 11-03b (`create-poll` retrofit), the audit_log table will capture every admin state change in v1.2.

Per-EF emission table (matches PATTERNS.md "Audit retrofit" table verbatim):

| EF | action | target_type | actor_id | Notes |
|----|--------|-------------|----------|-------|
| close-expired-polls | `poll_auto_closed` | `poll` | `null` (D-03) | One row per closed poll inside a sequential `for (const row of data ?? []) { … }` loop |
| close-poll | `poll_closed` | `poll` | `user.id` | `before:{status:'active'}`, `after:{status:'closed', resolution}` |
| create-category | `category_created` | `category` | `user.id` | `target_id = data.id` from the existing `.select('id, name').single()` |
| delete-category | `category_deleted` | `category` | `user.id` | Pre-fetch via `maybeSingle()` captures `name`; falls back to `{id}` on miss |
| delete-poll | `poll_deleted` | `poll` | `user.id` | Pre-fetch via `maybeSingle()` captures `title, status`; falls back to `{id}` on miss |
| demote-admin | `admin_demoted` | `profile` | `user.id` | `before:{is_admin:true}`, `after:{is_admin:false}` |
| pin-poll | `poll_pinned` / `poll_unpinned` | `poll` | `user.id` | Action branches on `isPinned`; `before`/`after` flip the boolean |
| promote-admin Branch 1 | `admin_promoted` | `profile` | `user.id` | `target_id = target_user_id`; one row |
| promote-admin Branch 2 (preauth) | `admin_preauthorized` | `admin_discord_ids` | `user.id` | `target_id = target_discord_id` (snowflake); guarded by `insertError === null` (23505 idempotent path skips it) |
| promote-admin Branch 2 (retroactive) | `admin_promoted` | `profile` | `user.id` | Sequential `for (const profile of promotedProfiles ?? []) { … }`; 0..N rows |
| rename-category | `category_renamed` | `category` | `user.id` | Pre-fetch via `maybeSingle()` captures old name |
| set-resolution | `resolution_set` | `poll` | `user.id` | Pre-fetch via `maybeSingle()` captures prior resolution |
| update-poll | `poll_updated` | `poll` | `user.id` | RPC-based; `before:null` (D-07); `after` carries the 6 mutated fields |

## Commits (11 atomic)

| EF | Commit |
|----|--------|
| close-expired-polls | 2d691ea |
| close-poll | 07f0887 |
| create-category | b9f8779 |
| delete-category | e5b76e7 |
| delete-poll | c1fe719 |
| demote-admin | 4d858db |
| pin-poll | ffe7140 |
| promote-admin | a99f7fb |
| rename-category | 3eedfe3 |
| set-resolution | f240dde |
| update-poll | 80985a8 |

## Verification (acceptance criteria + automated checks)

- All 11 EFs `import { writeAudit } from '../_shared/audit.ts'` — confirmed via grep loop
- `writeAudit(` call counts per EF: close-expired-polls=1, close-poll=1, create-category=1, delete-category=1, delete-poll=1, demote-admin=1, pin-poll=1, **promote-admin=3** (one Branch 1, one Branch 2 preauth, one Branch 2 retroactive-flip loop body), rename-category=1, set-resolution=1, update-poll=1
- `close-expired-polls` writes inside `for (const row of data ?? []) { ... }` loop and uses `actor_id: null`
- `pin-poll` branches action string on `isPinned`: `action: isPinned ? 'poll_pinned' : 'poll_unpinned'`
- `promote-admin` emits both `admin_promoted` (count: 2 — Branch 1 + Branch 2 loop body) and `admin_preauthorized` (count: 1, Branch 2 only, guarded by `insertError === null`)
- `promote-admin` Branch 2 preauth row uses `target_type: 'admin_discord_ids'`; both `admin_promoted` paths use `target_type: 'profile'` (count: 2)
- No EF wraps `writeAudit` in `try { ... }` (Pitfall 3 — fail-open is the helper's responsibility)
- No file gained review-round / Plan / Round / PR archaeology (CLAUDE.md WHY-only)
- `npm run lint` — exits 0
- `npm run test` — 41 test files, 389 tests, all pass
- Git diff scope: exactly the 11 files in the plan's `files_modified` list; no spillover

## Deviations from Plan

**None.** The plan's acceptance criteria and execution prescriptions were followed precisely:
- Used the plan-body's escape hatch for the 4 EFs that needed a pre-fetch (delete-category, delete-poll, rename-category, set-resolution): used `maybeSingle()` so the existing PGRST116 envelope is preserved exactly; fallback to `{id}` on miss.
- promote-admin two-branch retrofit followed REVIEW-FIX-C2-H2 exactly: one `admin_promoted` (Branch 1), one `admin_preauthorized` keyed on snowflake with `target_type='admin_discord_ids'` (Branch 2 preauth, guarded by `insertError === null`), one `admin_promoted` per row in the retroactive flip loop (Branch 2, 0..N rows).
- close-expired-polls uses sequential `await` in the per-closed-poll loop (D-03 + RESEARCH Pattern 5).

## Threat Flags

None — the retrofit introduces no new network surface, auth path, file access pattern, or schema change. It only inserts audit rows into the existing `audit_log` table after pre-existing mutations succeed.

## Known Stubs

None. All audit calls are wired to live request data and existing mutation results.

## Out-of-scope deferrals

- `create-poll` retrofit is deferred to Plan 11-03b (it carries the D-08/D-09/D-10 `results_hidden` body extension as a second deliverable, which warrants its own plan boundary).
- Deploy is gated to Plan 11-05 (no `supabase functions deploy` invoked from this plan).
- Runtime verification of `audit_log` row presence is gated to Plan 11-04 (TEST-12 covers toggle-results-visibility; the 11 retrofitted EFs are smoke-verified at deploy time in Plan 11-05).

## Self-Check: PASSED

- All 11 modified files present with `writeAudit` import and call(s) — verified via grep loop
- All 11 commit hashes present in `git log --oneline gsd/phase-11-schema-rls-ef-foundations..HEAD`
- `npm run lint` exits 0
- `npm run test` passes 389/389
- No files outside the plan's `files_modified` list were touched
