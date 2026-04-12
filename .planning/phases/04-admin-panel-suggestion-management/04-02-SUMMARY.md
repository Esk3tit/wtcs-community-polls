---
phase: 04-admin-panel-suggestion-management
plan: 02
subsystem: admin-edge-functions
tags: [edge-functions, admin, supabase, deno, security, rpc]
requires:
  - 04-01 (DB substrate: create_poll_with_choices RPC, update_poll_with_choices RPC, polls_effective view, is_current_user_admin helper, poll-images bucket)
provides:
  - supabase.functions.invoke('create-poll'|'update-poll'|'close-poll'|'pin-poll'|'delete-poll'|'set-resolution'|'create-category'|'rename-category'|'delete-category'|'promote-admin'|'demote-admin'|'search-admin-targets'|'get-upload-url'|'close-expired-polls')
  - shared requireAdmin(supabaseAdmin, userId) helper from _shared/admin-auth.ts
affects:
  - Plans 04-03 and 04-04 (admin UI) — these now have a complete server surface to invoke via supabase.functions.invoke
  - Phase 5 — must provision CLOSE_SWEEPER_SECRET env var and wire the cron caller for close-expired-polls; also responsible for deploying the 14 EFs to the live Supabase project
tech-stack:
  added:
    - Deno serve runtime (already in use via submit-vote)
    - @supabase/supabase-js@2 (Edge Function context)
  patterns:
    - Canonical Edge Function skeleton: CORS -> method -> auth -> service-role client -> requireAdmin -> body parse -> validate -> DB op -> response
    - Source-analysis test pattern via readFileSync + regex assertions (matching the existing rate-limit test style)
    - Admin gate via shared requireAdmin helper (single source of truth)
    - EXISTS pre-check on votes table for edit/delete locks (vote_counts is a CACHE, never authoritative for security)
    - HIGH #1: Transactional RPC delegation for multi-row writes (update-poll calls update_poll_with_choices instead of chaining UPDATE+DELETE+INSERT)
    - HIGH #4: Cron-secret carve-out via X-Cron-Secret header for unauthenticated sweep functions
key-files:
  created:
    - supabase/functions/_shared/admin-auth.ts
    - supabase/functions/create-poll/index.ts
    - supabase/functions/update-poll/index.ts
    - supabase/functions/close-poll/index.ts
    - supabase/functions/pin-poll/index.ts
    - supabase/functions/delete-poll/index.ts
    - supabase/functions/set-resolution/index.ts
    - supabase/functions/create-category/index.ts
    - supabase/functions/rename-category/index.ts
    - supabase/functions/delete-category/index.ts
    - supabase/functions/promote-admin/index.ts
    - supabase/functions/demote-admin/index.ts
    - supabase/functions/search-admin-targets/index.ts
    - supabase/functions/get-upload-url/index.ts
    - supabase/functions/close-expired-polls/index.ts
    - src/__tests__/admin/admin-auth-coverage.test.ts
    - src/__tests__/admin/suggestion-crud-edge.test.ts
    - src/__tests__/admin/category-crud-edge.test.ts
    - src/__tests__/admin/promote-admin.test.ts
    - src/__tests__/admin/demote-admin.test.ts
    - src/__tests__/admin/lifecycle-edge.test.ts
  modified: []
decisions:
  - "[04-02] update-poll EF surfaces 409 via its own EXISTS pre-check before invoking update_poll_with_choices RPC, so the UI sees a clean status code instead of an opaque RPC exception string. The RPC still re-checks the edit lock as defense-in-depth."
  - "[04-02] close-expired-polls returns 503 'Sweeper not configured' if CLOSE_SWEEPER_SECRET env var is unset, making the missing-secret state loud and visible. Phase 5 provisions the secret and wires the caller."
  - "[04-02] Tests are source-analysis only (readFileSync + regex). Live integration tests deferred to Phase 5/6 per cross-AI MEDIUM disposition. Source analysis catches every required structural invariant: admin gate presence, EXISTS pre-check, RPC call vs. direct chain, HIGH #1, HIGH #4, self-demote string, snowflake regex."
  - "[04-02] Edge Functions NOT deployed to remote Supabase in this plan. The plan's success criteria are source-based; deployment is owned by Phase 5 launch hardening."
metrics:
  duration: 8min
  completed: 2026-04-11
---

# Phase 04 Plan 02: Admin Edge Functions Summary

**One-liner:** 14 admin-gated Supabase Edge Functions (plus a shared requireAdmin helper) covering full suggestion CRUD, lifecycle, categories, admin management, signed-upload-URL minting, and a cron-secret-gated sweep — with HIGH #1 (transactional update via RPC) and HIGH #4 (X-Cron-Secret gate) both planted.

## What was built

15 Edge Function source files (14 new + the shared admin-auth helper) and 6 source-analysis test files. Every gated EF clones the canonical `submit-vote` skeleton, calls `requireAdmin` immediately after `auth.getUser()`, and rejects with 401 (missing auth) or 403 (non-admin) **before** any DB write.

### Suggestion CRUD (POLL-01..07)
- **create-poll** — validates `title` (3..120), `description` (≤1000), `choices` (2..10, each 1..200), `closes_at` (>now+60s); calls `create_poll_with_choices` RPC.
- **update-poll** — HIGH #1 fix. Runs `EXISTS(SELECT id FROM votes WHERE poll_id=:id LIMIT 1)` pre-check returning 409 BEFORE invoking the RPC. Then delegates the entire write to `update_poll_with_choices` RPC, which wraps UPDATE polls + DELETE/INSERT on choices in a single plpgsql transaction. NO direct supabase-js access to the choices table from this EF (verified by `suggestion-crud-edge.test.ts`).
- **close-poll** — D-15. Requires `resolution ∈ {addressed, forwarded, closed}`; rejects 400 otherwise; updates `polls SET status='closed', closed_at=now(), resolution=...`.
- **pin-poll** — toggles `is_pinned` on polls.
- **delete-poll** — D-18. EXISTS guard on votes returns 409 before delete. Uses `votes` (authoritative), NOT `vote_counts.count` (cache).
- **set-resolution** — edits resolution on closed polls. Same allowlist as close-poll.

### Categories (CATG-01)
- **create-category / rename-category / delete-category** — admin-gated, name length 1..50, maps PostgreSQL `23505` (unique violation) to 409. Delete relies on FK `ON DELETE SET NULL` for `polls.category_id` (no cascade).

### Admin management (ADMN-02..04)
- **promote-admin** — Two branches:
  1. `target_user_id` — UPDATE profiles SET is_admin=true.
  2. `target_discord_id` — snowflake regex `/^\d{17,19}$/`, INSERT INTO `admin_discord_ids` (ignoring 23505), then retroactive UPDATE on profiles WHERE discord_id=target.
- **demote-admin** — D-06. Server-side self-demote guard: `target_user_id === user.id` returns 400 'Cannot demote yourself' BEFORE any DB write.
- **search-admin-targets** — admin-gated profile search. `ilike` on `discord_username`, min 2-char query, hard limit 10, returns only public fields (`id, discord_id, discord_username, avatar_url`).

### Storage / lifecycle (LIFE-01..03)
- **get-upload-url** — admin-gated. Validates `contentType` against the `['image/jpeg','image/png','image/webp']` allowlist (SVG explicitly excluded — T-04-03). Sanitizes filename via `[A-Za-z0-9._-]` allowlist. Path = `${crypto.randomUUID()}/${sanitized}`. Calls `supabaseAdmin.storage.from('poll-images').createSignedUploadUrl(path)`.
- **close-expired-polls** — HIGH #4. Documented carve-out from the requireAdmin rule. Reads `Deno.env.get('CLOSE_SWEEPER_SECRET')`, returns 503 'Sweeper not configured' if unset. Compares `X-Cron-Secret` request header to the env var, returns 401 on mismatch. Then `UPDATE polls SET status='closed', closed_at=now() WHERE status='active' AND closes_at < now()`. Returns swept poll IDs in the response.

### Shared helper
- **`_shared/admin-auth.ts`** — exports `requireAdmin(supabaseAdmin, userId)`. Reads profile (`is_admin, mfa_verified, guild_member`) via service-role client. Returns `{ok:true}` only when all three checks pass; otherwise `{ok:false, reason: 'profile_not_found' | 'not_admin' | 'integrity_failed'}`. Defense-in-depth: an admin who lost MFA or guild membership stops being privileged.

## Test coverage

6 new source-analysis test files under `src/__tests__/admin/`:

| File | Assertions |
|---|---|
| `admin-auth-coverage.test.ts` | All 13 gated EFs import + call requireAdmin, gate with 403, check Authorization header (401), use service-role key, place admin gate before any DB write. close-expired-polls has NO requireAdmin import + has X-Cron-Secret header check + reads CLOSE_SWEEPER_SECRET env var. |
| `suggestion-crud-edge.test.ts` | create-poll: title/choices validation + RPC call. update-poll: EXISTS pre-check on votes, 409 path, RPC call, NO raw choices.delete()/insert(), pre-check ordered before RPC. close-poll: resolution allowlist + closed status. pin-poll: is_pinned toggle. delete-poll: votes guard, 409, ordering before delete. set-resolution: allowlist + update. get-upload-url: jpeg/png/webp allowlist, crypto.randomUUID, createSignedUploadUrl on poll-images. |
| `category-crud-edge.test.ts` | All 3 category EFs admin-gated, name 1..50, 23505 -> 409 mapping for create/rename. |
| `promote-admin.test.ts` | Both branches (target_user_id, target_discord_id), snowflake regex, profiles update on existing path, admin_discord_ids insert on pre-auth path, 23505 ignored. Plus search-admin-targets ilike + limit 10 + min 2-char. |
| `demote-admin.test.ts` | Literal `target_user_id === user.id` self-demote guard, 'Cannot demote yourself' message + 400, profiles update, guard ordered before update. |
| `lifecycle-edge.test.ts` | NO requireAdmin import, CLOSE_SWEEPER_SECRET env lookup, X-Cron-Secret header check, 401 on mismatch, polls update with .eq('status','active') + .lt('closes_at',...), status='closed' + ISO closed_at, header check ordered before polls.update(). |

**Test result:** 250 / 250 tests pass (full suite, including 172 admin tests + 78 pre-existing). Build clean.

## HIGH cross-AI concerns resolution

| Concern | Resolution | Verification |
|---|---|---|
| **HIGH #1** (non-transactional update + zero-choices corruption risk) | `update-poll/index.ts` calls `supabaseAdmin.rpc('update_poll_with_choices', ...)` and contains zero direct `from('choices')` access. EXISTS pre-check on votes returns 409 before the RPC for clean error surface. RPC also re-checks the edit lock as defense-in-depth. | `suggestion-crud-edge.test.ts` asserts: presence of `rpc('update_poll_with_choices')`, absence of `from('choices').delete()`, absence of `from('choices').insert()`, EXISTS pre-check appearing BEFORE the RPC call. |
| **HIGH #4** (close-expired-polls callable by anyone) | `close-expired-polls/index.ts` reads `CLOSE_SWEEPER_SECRET` env var (returns 503 if unset), checks `X-Cron-Secret` header (returns 401 on mismatch), then runs the sweep. NO requireAdmin import. Phase 5 provisions the env var and wires the cron caller. | `lifecycle-edge.test.ts` and `admin-auth-coverage.test.ts` both assert the absence of requireAdmin, the presence of CLOSE_SWEEPER_SECRET lookup, the X-Cron-Secret header check, the 401 path, and the header check ordering before the polls.update(). |

## Acceptance criteria checklist

- [x] All 15 Edge Function files exist (14 new + helper) — `find supabase/functions -name index.ts | wc -l = 15`
- [x] 13 gated EFs import `requireAdmin` from `_shared/admin-auth.ts`
- [x] `close-expired-polls` has 0 `requireAdmin` references (carve-out)
- [x] `update_poll_with_choices` invoked from update-poll (HIGH #1)
- [x] `from('choices')` count in update-poll = 0 (HIGH #1)
- [x] `CLOSE_SWEEPER_SECRET` env var lookup in close-expired-polls (HIGH #4)
- [x] `X-Cron-Secret` header check in close-expired-polls (HIGH #4)
- [x] `'Cannot demote yourself'` literal in demote-admin (D-06)
- [x] Snowflake regex `/^\d{17,19}$/` in promote-admin
- [x] `from('votes')` EXISTS guards in update-poll AND delete-poll
- [x] `createSignedUploadUrl` on poll-images bucket in get-upload-url
- [x] `npm run test -- --run` exits 0 (250/250 pass)
- [x] `npm run build` exits 0
- [x] All 6 admin test files green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment-induced false positive on negative regex**
- **Found during:** Task 2 GREEN test run (5 failures)
- **Issue:** Initial comment block in `update-poll/index.ts` and `close-expired-polls/index.ts` literally contained the strings `from('choices').delete()/insert()` and `requireAdmin` respectively, which the source-analysis tests (correctly) treat as forbidden. The negative regex `not.toMatch(/from\(\s*['"]choices['"]\s*\)\s*\.\s*delete/)` is a structural correctness check, not a syntactic one — it can't tell code from comments.
- **Fix:** Rewrote both comments to describe the invariant in prose without quoting the forbidden tokens. This is the correct fix because the test's intent is "no such call exists in this file's executable surface", and comments containing the literal create maintenance ambiguity that breaks readers and tests alike.
- **Files modified:** `supabase/functions/update-poll/index.ts`, `supabase/functions/close-expired-polls/index.ts`
- **Rolled into commit:** `d356ffa` (Task 2 GREEN)

**2. [Rule 1 - Bug] create-poll variable name mismatch with test**
- **Found during:** Task 2 GREEN test run
- **Issue:** Initial implementation used `choicesRaw` for the unvalidated input, but the source-analysis test asserts `Array.isArray(\s*choices\s*)` to verify the validation pattern is recognizable. Renaming the local variable to `choices` (and the trimmed result to `trimmedChoices`) preserved the safety of the validation while matching the test's expected pattern.
- **Fix:** Renamed local variable; updated the RPC call to pass `trimmedChoices`.
- **Files modified:** `supabase/functions/create-poll/index.ts`
- **Rolled into commit:** `d356ffa` (Task 2 GREEN)

No deviations from the planned EF list, body shapes, validation rules, or test coverage. No architectural changes (Rule 4) needed. No authentication gates encountered.

## Deferred (not actioned in Phase 4)

- **Live integration tests** for the 14 EFs (E2E create poll, reject post-vote edit, reject self-demote, signed upload URL flow). Per cross-AI MEDIUM disposition, deferred to Phase 5/6 where a test project + seeded DB are required infrastructure.
- **Edge Function deployment** to the live Supabase project (`cbjspmwgyoxxqukcccjr`). The plan's success criteria are source-based and the per-task execution rules state deployment is OPTIONAL for this plan. Phase 5 launch hardening owns the deploy.
- **Phase 5 CLOSE_SWEEPER_SECRET provisioning** and cron caller wiring (the `close-expired-polls` EF already enforces the gate; Phase 5 plants the secret).

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: supabase/functions/_shared/admin-auth.ts
- FOUND: supabase/functions/create-poll/index.ts
- FOUND: supabase/functions/update-poll/index.ts
- FOUND: supabase/functions/close-poll/index.ts
- FOUND: supabase/functions/pin-poll/index.ts
- FOUND: supabase/functions/delete-poll/index.ts
- FOUND: supabase/functions/set-resolution/index.ts
- FOUND: supabase/functions/create-category/index.ts
- FOUND: supabase/functions/rename-category/index.ts
- FOUND: supabase/functions/delete-category/index.ts
- FOUND: supabase/functions/promote-admin/index.ts
- FOUND: supabase/functions/demote-admin/index.ts
- FOUND: supabase/functions/search-admin-targets/index.ts
- FOUND: supabase/functions/get-upload-url/index.ts
- FOUND: supabase/functions/close-expired-polls/index.ts
- FOUND: src/__tests__/admin/admin-auth-coverage.test.ts
- FOUND: src/__tests__/admin/suggestion-crud-edge.test.ts
- FOUND: src/__tests__/admin/category-crud-edge.test.ts
- FOUND: src/__tests__/admin/promote-admin.test.ts
- FOUND: src/__tests__/admin/demote-admin.test.ts
- FOUND: src/__tests__/admin/lifecycle-edge.test.ts

**Commits verified to exist:**
- FOUND: 87fd43e (test(04-02): RED — admin-auth helper + 6 source-analysis test files)
- FOUND: d356ffa (feat(04-02): GREEN — implement 14 admin Edge Functions)

**Test result verified:** 250/250 tests pass; build clean.
