---
phase: 04
iterations: 1
date: 2026-04-11
review_path: .planning/phases/04-admin-panel-suggestion-management/04-REVIEW.md
findings_in_scope: 7
fixed: 6
deferred: 1
status: partial
---

# Phase 4 Review-Fix Report

## Summary

- **In scope:** Critical=0, High=1, Medium=6 (total 7)
- **Fixed:** 6
- **Deferred:** 1 (ME-03 — test-quality meta issue, non-blocking per review)
- **Iterations:** 1 / 3

All fixes land on branch `gsd/phase-04-admin-panel-suggestion-management` (PR #3). No worktree isolation. Atomic per-finding commits with `fix(04-review): ...` subjects.

## Applied fixes

| Finding | Files | Fix commit | Test result |
|---|---|---|---|
| HI-01 | `src/hooks/useSuggestions.ts` | `0055e94` | 299/299 -> 299/299 |
| ME-01 | `supabase/migrations/00000000000006_update_poll_rpc_error_codes.sql` (new), `supabase/functions/update-poll/index.ts`, `src/__tests__/admin/admin-migration.test.ts`, `src/__tests__/admin/suggestion-crud-edge.test.ts` | `323531b` | 299 -> 308 (+9 new assertions) |
| ME-02 | `supabase/functions/get-upload-url/index.ts` | `ab04ee0` | 308/308 |
| ME-04 | `src/lib/fn-error.ts` (new), `src/hooks/useCreatePoll.ts`, `useUpdatePoll.ts`, `useDeletePoll.ts`, `useClosePoll.ts`, `usePinPoll.ts`, `useSetResolution.ts`, `useCategoryMutations.ts` | `a0bd4b5` | 308/308 |
| ME-05 | `src/components/admin/AdminSuggestionsTab.tsx`, `src/__tests__/admin/admin-suggestions-tab.test.tsx` | `43324ce` | 308/308 |
| ME-06 | `src/hooks/usePromoteAdmin.ts`, `src/hooks/useDemoteAdmin.ts` | `7179cf9` | 308/308 |

### HI-01 — useSuggestions bounded votes fetch

**Fix:** Added `.in('poll_id', pollIds)` to the votes query and short-circuit when `pollIds` is empty. Kept the stale-fetch guard (`fetchRef.current !== fetchId`) — it is still load-bearing alongside the `cancelled` closure flag because `refetch()` bumps `fetchTrigger` while a previous run may be in flight. Comment clarified.

### ME-01 — update-poll RPC error mapping via SQLSTATE

**Fix:** New append-only migration `00000000000006_update_poll_rpc_error_codes.sql` redefines `update_poll_with_choices` via `CREATE OR REPLACE FUNCTION` with `RAISE EXCEPTION ... USING ERRCODE = 'P000x'`:

- `P0002` -> Poll not found -> HTTP 404
- `P0003` -> Responses already received (edit lock) -> HTTP 409
- `P0004` -> Choice count out of range -> HTTP 400

Migration 5 is untouched (already applied to remote project `cbjspmwgyoxxqukcccjr`). The update-poll EF now keys on `rpcError.code` with a message-regex fallback kept for graceful migration propagation.

**DEPLOY DEPENDENCY — must push to remote:** Migration 6 is committed to the repo but has NOT been applied to the remote Supabase project `cbjspmwgyoxxqukcccjr`. The `supabase` CLI was not available in this session's toolkit and the MCP tool `mcp__plugin_supabase_supabase__apply_migration` was not registered either. Run before merging PR #3:

```
npx supabase db push --project-ref cbjspmwgyoxxqukcccjr
```

Behavior is correct in the interim because the EF retains the legacy message-regex matcher as a fallback — neither side "breaks" until the migration lands, and the EF will automatically prefer the `rpcError.code` path once it is available.

### ME-02 — canonical filename extension by contentType

**Fix:** `get-upload-url` now strips any trailing `.ext` from the sanitized base name and appends the canonical extension (`jpg` / `png` / `webp`) derived from the validated contentType. Security was already correct (Supabase Storage enforces MIME allowlist at PUT time); this is UX / CDN consistency hardening.

### ME-04 — shared FunctionError helper

**Fix:** Extracted `extractFunctionError(error, fallback)` and `extractFunctionErrorMessage(error, fallback)` into `src/lib/fn-error.ts`. Nine admin hooks (all of the Phase 4 admin mutation hooks) now import from there instead of carrying a local duplicate. Two hooks (`useUpdatePoll`, `useDeletePoll`) use the full `{ msg, status }` variant for 409 detection.

### ME-05 — scope admin vote_counts to visible polls

**Fix:** `AdminSuggestionsTab.fetchAll` now computes `pollIds` from the `polls_effective` result first, scopes the `vote_counts` query via `.in('poll_id', pollIds)`, and skips it entirely when `pollIds.length === 0`. Updated the test mock to expose `.in()` on the thenable builder and seeded one poll row in the `vote_counts`-failure test (the failure path is now unreachable with empty polls because the query is skipped).

### ME-06 — catch branch on promote/demote hooks

**Fix:** Added `catch { toast.error(...); return { ok: false } }` to `usePromoteAdmin.promote` and `useDemoteAdmin.demote`, mirroring the `useCreatePoll` try/catch/finally pattern. In the normal path supabase-js surfaces HTTP errors in the resolved envelope (so the catch is never hit), but a synchronous throw from `supabase.functions.invoke` (bad client state) would previously propagate as an unhandled rejection into `PromoteAdminDialog` / `DemoteAdminDialog`. Both callsites used `extractMessage` locally — this commit also rolls them onto the ME-04 shared helper.

## Deferred

### ME-03 — source-analysis tests are shape-only

**Reason:** Meta issue. The review itself classifies this as "Non-blocking for merge" and recommends tracking as Phase 5 prep. The prior cross-AI review already flagged the same concern. Resolving it properly requires a full integration-test harness (Supabase local stack or equivalent stub server) which is out of scope for a review-fix pass.

Tracked for Phase 5 prep. No commit in this pass.

## Iteration 2 / spot re-review

**Not triggered.** Spot review of the touched files surfaces no new Critical/High/Medium findings:

- **HI-01 useSuggestions.ts** — pollIds guard correct; stale-fetch guard comment updated.
- **ME-01 update-poll + migration 6** — CREATE OR REPLACE preserves signature; EF fallback is intentional for graceful migration propagation.
- **ME-02 get-upload-url** — base-name strip + canonical append; `'upload'` fallback preserved.
- **ME-04 fn-error.ts** — identical semantics to previous inline copies; 9 call sites migrated correctly.
- **ME-05 AdminSuggestionsTab.tsx** — scoped query with empty guard.
- **ME-06 usePromoteAdmin/useDemoteAdmin** — catch before finally, mirrors useCreatePoll.

Only operational concern is the migration-6 deploy dependency (flagged in ME-01 above). No iteration 2 fixes required.

## Test counts

- **Before fixes:** 299 / 299 passing
- **After fixes:** 308 / 308 passing (+9: new ME-01 source-analysis + migration assertions)
- **Build:** clean (`npm run build` -> `built in 196ms`, no errors, no warnings)
- **TypeScript:** clean (`tsc -b --noEmit` passed in every lint-staged run)
- **ESLint:** clean (`--max-warnings 0` passed in every lint-staged run)

## Go / no-go

**GO** for merging PR #3 into `main`, **with one deploy precondition:**

Run `npx supabase db push --project-ref cbjspmwgyoxxqukcccjr` before (or immediately after) merging so migration 6 lands on the remote project. The EF's message-regex fallback means merging without pushing the migration is not a functional regression — it just means the SQLSTATE-matching improvement from ME-01 is latent until the migration is applied.

All other fixes are self-contained in the repo and take effect on next Netlify deploy of the frontend + `supabase functions deploy` for the two EFs touched (`update-poll`, `get-upload-url`).

---

_Fixed: 2026-04-11_
_Fixer: Claude (gsd-code-fixer, Opus 4.6 1M)_
_Iteration: 1 / 3_
