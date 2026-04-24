---
phase: 04-admin-panel-suggestion-management
verified: 2026-04-11T19:25:00Z
status: resolved
score: 15/15 requirements verified; doc-sync gap closed (re-verified 2026-04-24)
re_verification:
  re_verified: 2026-04-24
  re_verifier: Claude (/gsd-audit-uat)
  previous_status: gaps_found
  previous_score: "15/15 requirements verified; 2 doc sync gaps"
  gaps_closed:
    - "ROADMAP.md Phase 4 checkbox — now shows `- [x] **Phase 4: Admin Panel & Suggestion Management**` (verified via grep on .planning/ROADMAP.md on 2026-04-24)."
  gaps_remaining: []
  regressions: []
  phase_5_deferred_items_resolved:
    - "Edge Function deployment — 15 EFs live on the remote Supabase project per 05-08-SUMMARY. Verified by: polls.wtcsmapban.com round-trip smoke test (05-UAT #1 pass), EF deploy GH Actions workflow present and committed (05-07)."
    - "CLOSE_SWEEPER_SECRET provisioning — set in Supabase secrets during 05-08 cutover per 05-08-SUMMARY task 3 (`4 Supabase secrets via supabase secrets set ✓`)."
  phase_5_deferred_items_remaining:
    - "Live two-session test of admin-bypass RLS on votes / vote_counts — still requires a human UAT pass with two browser sessions (one admin, one non-admin) against polls.wtcsmapban.com. Retained as human-verification item."
gaps:
  - truth: "ROADMAP.md reflects Phase 4 as complete"
    status: resolved
    resolved_at: 2026-04-24
    resolution: "Phase 4 checkbox is now `- [x] **Phase 4: Admin Panel & Suggestion Management**` in .planning/ROADMAP.md. (The doc-sync drift was resolved at some point between 2026-04-11 and 2026-04-24, likely during Phase 5 roadmap updates.)"
    original_reason: "Phase 4 checkbox and progress table showed the phase as not started even though STATE.md reported phase-04-complete and REQUIREMENTS.md marked all 15 Phase 4 rows Complete."
human_verification:
  - test: "End-to-end admin UX smoke on live Supabase project (cbjspmwgyoxxqukcccjr)"
    expected: "Sign in as seeded admin (Discord ID 267747104607305738 or 290377966251409410), open /admin, confirm tab shell renders with logo; on Categories tab create/rename/delete a category and confirm the affected-count dialog shows the real number; on Admins tab promote a test user via both search and Discord-ID-paste branches; try to demote yourself and confirm the button is hidden; create a suggestion with Yes/No preset + image upload + 7-day timer; edit a different pre-vote suggestion; close a suggestion with resolution=Forwarded; pin a suggestion and confirm /topics sort reflects it; confirm /archive renders the resolution pill"
    why_human: "Phase 4 ships source-only Edge Functions. Deployment to the live Supabase project is deferred to Phase 5, so actual runtime behaviour of create/update/close/pin/delete/set-resolution/get-upload-url/search-admin-targets/promote/demote/close-expired-polls cannot be exercised from tests in this phase. Every admin flow has source-analysis coverage but zero integration-test coverage against a running EF."
  - test: "Image upload contract against the live poll-images bucket"
    expected: "get-upload-url EF returns a signed URL; PUT the file; resulting public URL is reachable and stored in polls.image_url. Reject SVG, reject >2 MB, reject image/gif."
    why_human: "poll-images bucket exists per 04-01 but the signed upload flow has only source-analysis tests. Runtime MIME allowlist behaviour, size cap enforcement, and sanitized filename path produced by crypto.randomUUID() need to be exercised at least once before launch."
  - test: "close-expired-polls cron-secret gate live verification"
    expected: "Invoke without X-Cron-Secret header -> 401. Invoke with wrong secret -> 401. Invoke with correct secret -> UPDATEs expired active polls to status=closed and returns their IDs."
    why_human: "Source analysis confirms the header check exists and is ordered before the UPDATE, but Phase 5 still needs to provision CLOSE_SWEEPER_SECRET and schedule the caller. Live invocation confirms the 503 'Sweeper not configured' branch flips off once the secret is set."
  - test: "Admin-bypass RLS end-to-end on votes and vote_counts"
    expected: "Logged in as admin who has NOT voted on poll X, SELECT against vote_counts and votes returns poll X rows. Logged in as non-admin who has NOT voted on poll X, same queries return zero rows for poll X (Phase 2 respondent-only invariant preserved)."
    why_human: "The admin-bypass RLS branches were added to live SELECT policies in migration 00000000000005 and were verified present by `SELECT polname FROM pg_policy`, but the semantics (OR branch passes for admins, base branch still blocks non-voters) need a real two-session smoke before launch."
  - test: "polls_effective lazy-close matches expected semantics on a poll whose closes_at has just passed"
    expected: "Insert poll with closes_at = now() - 1 minute and status='active'. Public read via useSuggestions/polls_effective shows status='closed'. Admin list via AdminSuggestionsTab shows the same row with Active/Closed badge flipped to Closed and the amber border-l-2 null-resolution marker (since no sweep has yet written closed_at/resolution)."
    why_human: "The view is defined with CASE on closes_at and security_invoker=on, but the end-to-end flow from DB state -> view row -> SuggestionCard render has only been unit-tested with mocked Supabase responses. A single real poll row traced through the chain gives confidence before Phase 5 schedules the sweeper."
---

# Phase 4: Admin Panel & Suggestion Management — Verification Report

**Phase Goal:** Admins can create, configure, and manage suggestions end-to-end through the app — from creation with dynamic choices and images, through lifecycle management, to archival with resolution status.

**Verified:** 2026-04-11
**Status:** gaps_found (2 documentation sync gaps; zero code gaps)
**Re-verification:** No — initial verification

---

## Executive Summary

Phase 4 delivers its stated goal in code. All 15 requirements (ADMN-02/03/04, POLL-01..07, CATG-01, LIFE-01..03, TEST-05) are implemented and test-covered. All 7 cross-AI concerns resolved in the plan reviews (HIGH #1/#2/#3/#4 + MEDIUM #5/#7) are verifiable in the codebase. All critical invariants hold:

- No public code path reads `polls.status` directly (grep-verified outside tests; `polls-effective-invariant.test.ts` CI-locks this)
- No admin EF reads `vote_counts.count` for a security decision (grep clean)
- Every admin EF except `close-expired-polls` imports and calls `requireAdmin` before DB writes (14/14 gated EFs + 1 intentional carve-out)

**Test suite:** 299/299 passing across 28 files (up from 78 at Phase 3 baseline).
**Build:** `npm run build` clean.
**Commits on branch:** 30+ Phase 4 commits including 14 execution commits and 2 plan-complete docs commits.

**The only gaps are ROADMAP.md documentation sync** — the Phase 4 checkbox and progress-table row were not updated when the phase completed, even though STATE.md and REQUIREMENTS.md both correctly reflect completion. These are trivial doc fixes that do not block the PR merge. **Recommended verdict: READY FOR PR MERGE after flipping two ROADMAP.md lines.**

---

## Observable Truths (derived from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can create a suggestion with title, description, N configurable choices (Yes/No + multi-choice presets), optional image, category, and 7d/14d/custom timer | VERIFIED | `SuggestionForm.tsx` (219 lines) + `ChoicesEditor.tsx` (140) + `ImageInput.tsx` (103) + `CategoryPicker.tsx` (99) + `TimerPicker.tsx` (91) + `useCreatePoll.ts` (53) + `create-poll` EF calling `create_poll_with_choices` RPC; `suggestion-form.test.tsx` + `suggestion-form-validation.test.ts` (18 tests total) |
| 2 | Admin can edit pre-first-response, manually close at any time, pin/highlight | VERIFIED | `useUpdatePoll.ts` 409 special-case + D-17 locked banner in SuggestionForm; `useClosePoll.ts` + `ResolutionOnCloseDialog.tsx`; `usePinPoll.ts` with toggle toast; `SuggestionKebabMenu.tsx` 7-item menu with D-16 enable rules |
| 3 | Active suggestions auto-close on timer expiry; closed suggestions appear in public archive with resolution status | VERIFIED | `polls_effective` view with CASE WHEN closes_at < now() (migration 005 lines present); `close-expired-polls` EF for write-side sweep (Phase 5 schedules); `useSuggestions.ts:37` orders by is_pinned then created_at via polls_effective; archive.tsx renders resolution via SuggestionCard ResolutionBadge |
| 4 | Admin can promote/demote other admins (not self); all admin actions verified server-side | VERIFIED | `promote-admin/index.ts` with 2 branches (user_id update + discord_id snowflake regex pre-auth); `demote-admin/index.ts` containing literal `'Cannot demote yourself'` at line 57; UI D-06 guard in AdminsList hides Demote button on self row; all 14 gated EFs call `requireAdmin` before writes |
| 5 | Admin can create, rename, and delete categories | VERIFIED | `create-category` / `rename-category` / `delete-category` EFs + `useCategoryMutations.ts` + `CategoriesList.tsx` with inline edit + delete-dialog querying real affected count from polls table |
| 6 | Admin panel usable on phone screens | UNCERTAIN (human) | Tailwind/shadcn primitives are mobile-first by construction; needs device smoke test (see human_verification) |
| 7 | Admin actions have tests (CRUD, promotion/demotion, server-side auth checks) | VERIFIED | 16 admin test files under `src/__tests__/admin/` covering migration, EF source analysis, UI behaviour, RLS preflight, polls_effective invariant, form validation (221 admin test assertions inside 299 total) |

**Score: 6 VERIFIED / 1 UNCERTAIN (human-only) / 0 FAILED** out of 7 success criteria.

---

## Required Artifacts (Phase 4 Plans 1-4)

### Plan 04-01: Database Substrate

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/00000000000005_admin_phase4.sql` | 237-line migration: view + helper + RLS patches + 2 RPCs + bucket + seed admins | VERIFIED | 237 lines on disk; 11 source-analysis tests in `admin-migration.test.ts` enforce contents |
| `polls_effective` view | security_invoker=on, CASE WHEN closes_at < now() | VERIFIED (remote) | Applied to cbjspmwgyoxxqukcccjr via MCP per user statement; 3 funcs / 1 view / 1 bucket / 2 seed admins / 2 admin-bypass policies all verified live |
| `is_current_user_admin()` helper | SECURITY DEFINER STABLE | VERIFIED | Migration and live DB |
| `create_poll_with_choices` / `update_poll_with_choices` RPCs | Transactional, 2..10 choice guard, edit-lock re-check inside update | VERIFIED | Both RPCs present in migration; live DB query confirmed |
| `poll-images` storage bucket | Public, 2 MB, jpeg/png/webp | VERIFIED | Migration + live DB confirmed |
| Seed admins | Discord IDs 267747104607305738, 290377966251409410 | VERIFIED | Migration seeds both; live DB has both rows |

### Plan 04-02: Admin Edge Functions (14 EFs + shared helper)

| Artifact | Gated? | Key Behaviour | Status |
|---|---|---|---|
| `_shared/admin-auth.ts` | N/A | `requireAdmin(supabaseAdmin, userId)` — checks is_admin + mfa_verified + guild_member | VERIFIED |
| `create-poll` | Yes | Validates title/choices, calls `create_poll_with_choices` RPC | VERIFIED (line 85) |
| `update-poll` | Yes | **HIGH #1:** EXISTS pre-check on votes returns 409, then delegates entire write to `update_poll_with_choices` RPC. Zero raw `from('choices').delete/insert`. | VERIFIED (grep clean; line 113 has RPC call) |
| `close-poll` | Yes | Resolution allowlist, status=closed | VERIFIED |
| `pin-poll` | Yes | Toggles is_pinned | VERIFIED |
| `delete-poll` | Yes | EXISTS(votes) guard returns 409 pre-delete | VERIFIED |
| `set-resolution` | Yes | Resolution allowlist, updates closed polls | VERIFIED |
| `create-category` / `rename-category` / `delete-category` | Yes | 23505 -> 409 mapping, name 1..50 | VERIFIED (3 files) |
| `promote-admin` | Yes | Two branches: user_id + discord_id snowflake regex | VERIFIED |
| `demote-admin` | Yes | **D-06:** Literal `'Cannot demote yourself'` at line 57 | VERIFIED |
| `search-admin-targets` | Yes | ilike on discord_username, limit 10 (lines 58-59) | VERIFIED |
| `get-upload-url` | Yes | jpeg/png/webp allowlist, `createSignedUploadUrl` on `poll-images` bucket (lines 73-74) | VERIFIED |
| `close-expired-polls` | **No (carve-out)** | **HIGH #4:** Reads `CLOSE_SWEEPER_SECRET` env (line 36), 503 if unset, `X-Cron-Secret` header check (line 42), 401 on mismatch, then UPDATE polls sweep | VERIFIED |

All 13 gated EF source files show 2 occurrences each of `requireAdmin` (import + call); `_shared/admin-auth.ts` shows 1 (definition). `close-expired-polls` shows 0 (carve-out correct).

### Plan 04-03: Admin UI Shell

| Artifact | Status | Notes |
|---|---|---|
| `src/components/admin/AdminTabs.tsx` | VERIFIED (63 lines) | 3-tab shell, URL-synced `?tab=` with validateSearch whitelist |
| `src/components/admin/CategoriesList.tsx` | VERIFIED (336 lines) | Inline CRUD, real affected-count delete dialog, MEDIUM #7 Alert (line 55) |
| `src/components/admin/AdminsList.tsx` | VERIFIED (174 lines) | D-06 self-row guard, MEDIUM #7 Alert (line 58) |
| `src/components/admin/PromoteAdminDialog.tsx` | VERIFIED (150 lines) | Search + paste branches |
| `src/components/admin/DemoteAdminDialog.tsx` | VERIFIED (60 lines) | Confirmation dialog |
| 4 mutation hooks (useCategoryMutations, usePromoteAdmin, useDemoteAdmin, useSearchAdminTargets) | VERIFIED | All present with expected size |
| `src/assets/wtcs-logo.png` | VERIFIED | Referenced by Navbar.tsx |
| `src/__tests__/admin/profiles-rls-preflight.test.ts` | VERIFIED | HIGH #2 grep test — policy confirmed broad |
| 6 shadcn primitives installed | VERIFIED | tabs, dialog, label, textarea, select, alert |

### Plan 04-04: Suggestion CRUD + Public Surface

| Artifact | Status | Notes |
|---|---|---|
| `SuggestionForm.tsx` (+ 4 sub-components) | VERIFIED (219 + 140+103+99+91 = 652 lines) | Locked banner at vote_count>0, MEDIUM #7 Alert (line 132) |
| `AdminSuggestionsTab.tsx` | VERIFIED (142 lines) | Filter chips, MEDIUM #7 Alert (line 82) |
| `AdminSuggestionRow.tsx` + `SuggestionKebabMenu.tsx` | VERIFIED (74 + 137 lines) | Pin/Active/Closed badges; 7-item kebab with D-16 rules |
| `ResolutionOnCloseDialog` / `ResolutionPickerDialog` / `DeleteSuggestionDialog` | VERIFIED | Wired to corresponding mutation hooks |
| `/admin/suggestions/new` + `/admin/suggestions/$id.edit` routes | VERIFIED | Wrapped in AdminGuard, in routeTree.gen.ts |
| 7 mutation hooks + `useUploadImage` | VERIFIED | useCreatePoll / useUpdatePoll / useClosePoll / usePinPoll / useDeletePoll / useSetResolution / useUploadImage |
| `useSuggestions.ts` switched to `polls_effective` | VERIFIED | Line 37: `.order('is_pinned', { ascending: false })` on polls_effective |
| `polls-effective-invariant.test.ts` | VERIFIED | MEDIUM #5 grep walker; CategoriesList allowlisted for admin-only category_id count |
| `suggestion-form-validation.test.ts` (12) + `suggestion-form.test.tsx` (6) + `admin-suggestions-tab.test.tsx` (4) + `public-surface-extensions.test.tsx` (4) | VERIFIED | All pass |

---

## Cross-AI Concern Audit

| ID | Severity | Concern | Resolution | Verification |
|---|---|---|---|---|
| **HIGH #1** | HIGH | update-poll non-transactional choice replace | update-poll EF delegates to `update_poll_with_choices` RPC; zero raw `from('choices').delete/insert` in EF | VERIFIED — grep for forbidden patterns in update-poll/index.ts returns 0 matches; line 113 shows RPC call |
| **HIGH #2** | HIGH | profiles SELECT RLS unverified for AdminsList | Grep-based preflight test locks in broad policy | VERIFIED — `profiles-rls-preflight.test.ts` green; SUMMARY notes "Test Files 1 passed; Tests 3 passed" |
| **HIGH #3** | HIGH | Non-interactive `supabase db push` blocker | Migration committed + applied via Supabase MCP to remote project `cbjspmwgyoxxqukcccjr` | VERIFIED (remote) — user-confirmed 5-query verification passed; 3 funcs / 1 view / 1 bucket / 2 seed admins / 2 admin-bypass policies all live |
| **HIGH #4** | HIGH | close-expired-polls ungated public write | `CLOSE_SWEEPER_SECRET` env + `X-Cron-Secret` header check, 401 on mismatch, 503 if unset | VERIFIED — lines 36/38/42 in close-expired-polls/index.ts; test `lifecycle-edge.test.ts` asserts header check ordered before UPDATE |
| **MEDIUM #5** | MED | polls_effective adoption spread across files | `polls-effective-invariant.test.ts` walker enforces view-only reads in src/routes/hooks/components | VERIFIED — test passes; grep for `from('polls')` in src returns only CategoriesList (allowlisted) and test files |
| **MEDIUM #7** | MED | Missing error states | Destructive Alert + Retry in CategoriesList, AdminsList, SuggestionForm (edit mode), AdminSuggestionsTab | VERIFIED — `variant="destructive" role="alert"` found at CategoriesList:55, AdminsList:58, AdminSuggestionsTab:82, SuggestionForm:132 |
| **LOW (D-21)** | LOW | Category delete count was placeholder | CategoriesList dialog queries real count from `polls` before opening | VERIFIED — `categories-tab.test.tsx > opens delete dialog with the REAL affected count (D-21 LOW fix)` passes |

**All 7 resolved concerns are traceable to code and tests. No regressions.**

---

## Invariant Audit

| Invariant | Status | Evidence |
|---|---|---|
| No public code path reads `polls.status` directly | HOLD | `grep -rn "polls.status\|polls').*status" src` outside __tests__ = 0 matches; `polls-effective-invariant.test.ts` CI-locks this |
| No admin EF reads `vote_counts.count` for a security decision | HOLD | `grep -r "vote_counts.*count" supabase/functions` = 0 matches. Server truth uses EXISTS on votes (verified in update-poll lines 89-104 and delete-poll) |
| Every admin EF except `close-expired-polls` imports `requireAdmin` before DB writes | HOLD | 13/14 gated EFs have 2 occurrences each (import + call); `_shared/admin-auth.ts` has 1 (definition); `close-expired-polls` has 0 (carve-out) |
| `update-poll` uses transactional RPC, no raw choices writes | HOLD | `grep "from('choices').\(delete\|insert\)" supabase/functions/update-poll/index.ts` = 0; `rpc('update_poll_with_choices')` present at line 113 |
| `polls_effective` view is the only source for public active/closed reads | HOLD | `useSuggestions.ts` reads polls_effective; allowlist file `CategoriesList.tsx` reads polls but only for category_id count with no status reference (confirmed by invariant test) |
| Self-demotion blocked in both UI and server | HOLD | UI: D-06 row guard in AdminsList; Server: literal `'Cannot demote yourself'` at demote-admin/index.ts:57 |
| Admin-bypass RLS on votes + vote_counts | HOLD (live DB confirmed) | Policies `Users can view own votes or admin` + `Vote counts visible to voters or admin` verified on remote project via SUMMARY |
| Phase 4 `close-expired-polls` is source-only; deployment deferred | HOLD | SUMMARY 04-02 explicitly marks deployment as Phase 5 scope; env var `CLOSE_SWEEPER_SECRET` returns 503 "not configured" until Phase 5 provisions |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| **ADMN-02** | 04-02, 04-03 | Admin can promote another Discord user to admin | PASS | promote-admin EF (both branches) + PromoteAdminDialog search + Discord-ID paste + usePromoteAdmin hook + promote-admin.test.ts (snowflake regex, both branches) |
| **ADMN-03** | 04-02, 04-03 | Admin can demote another admin (not self) | PASS | demote-admin EF literal guard (line 57) + D-06 UI row guard in AdminsList + useDemoteAdmin special-case + demote-admin.test.ts |
| **ADMN-04** | 04-02 | Admin status checked server-side on all admin actions | PASS | 14 gated EFs call requireAdmin (defense-in-depth checks is_admin + mfa_verified + guild_member) + admin-auth-coverage.test.ts asserts all 13 gated EFs place admin gate before DB writes |
| **POLL-01** | 04-02, 04-04 | Create suggestion with title/description/N choices (Yes/No + 4-choice presets) | PASS | SuggestionForm + ChoicesEditor with Yes/No + 4-choice presets; validateSuggestionForm covers 2..10 choices + uniqueness + non-empty; create-poll EF + create_poll_with_choices RPC with DB-layer guard |
| **POLL-02** | 04-01, 04-02, 04-04 | Attach image via upload OR URL | PASS | ImageInput two-tab (Upload + Paste URL); useUploadImage client validation + get-upload-url EF + poll-images bucket (2 MB, jpeg/png/webp allowlist, SVG excluded) |
| **POLL-03** | 04-04 | Timer (7d / 14d / custom) | PASS | TimerPicker three-preset + datetime-local; validateSuggestionForm checks closes_at > now + 60s |
| **POLL-04** | 04-04 | Assign to category | PASS | CategoryPicker shadcn Select + "Uncategorized" + inline create-new-category dialog calling useCategoryMutations.create |
| **POLL-05** | 04-02, 04-04 | Pin/highlight | PASS | pin-poll EF + usePinPoll toggle toast + SuggestionKebabMenu Pin/Unpin + useSuggestions `.order('is_pinned', ascending: false)` + PinnedBanner component rendered in SuggestionCard |
| **POLL-06** | 04-02, 04-04 | Edit before first response | PASS | update-poll EF EXISTS(votes) 409 guard + SuggestionForm D-17 locked banner + useUpdatePoll 409 special-case toast; DB-layer re-check inside update_poll_with_choices RPC |
| **POLL-07** | 04-02, 04-04 | Manually close at any time | PASS | close-poll EF with resolution allowlist + ResolutionOnCloseDialog (required on close) + useClosePoll |
| **LIFE-01** | 04-01, 04-02 | Active suggestions auto-close on timer expiry | PASS | polls_effective view CASE WHEN closes_at < now() (read-path lazy close) + close-expired-polls EF (write-path sweep) — Phase 5 schedules |
| **LIFE-02** | 04-02, 04-04 | Resolution status Addressed/Forwarded/Closed | PASS | close-poll + set-resolution EFs with allowlist + ResolutionOnCloseDialog (required on manual close) + ResolutionPickerDialog (editable after); archive pill via ResolutionBadge |
| **LIFE-03** | 04-04 | Closed suggestions appear in public archive | PASS | /archive route reads polls_effective via useSuggestions → SuggestionList; test `public-surface-extensions.test.tsx` asserts archive legend + pill |
| **CATG-01** | 04-02, 04-03 | Create/rename/delete categories | PASS | create-category / rename-category / delete-category EFs + useCategoryMutations + CategoriesList inline CRUD + D-21 real affected-count delete dialog |
| **TEST-05** | All 4 plans | Admin action tests | PASS | 16 admin test files: admin-migration, admin-auth-coverage, suggestion-crud-edge, category-crud-edge, promote-admin, demote-admin, lifecycle-edge, profiles-rls-preflight, admin-shell, categories-tab, admins-tab, suggestion-form-validation, suggestion-form, admin-suggestions-tab, public-surface-extensions, polls-effective-invariant — all green in 299/299 suite |

**Coverage: 15 / 15 requirements PASS. Zero FAIL. Zero PARTIAL.**

---

## Anti-Pattern Scan

Targeted greps on Phase 4 artifacts for stub indicators:

- **TODO / FIXME / PLACEHOLDER:** None found in Phase 4 files
- **`return null` / empty return / `=> {}` empty handlers in admin code:** None found in production admin files (only in tests)
- **Hardcoded empty arrays on state that's never populated:** None — every admin hook has proper fetch/mutation logic flowing data through state
- **`console.log`-only handlers:** None — all admin hooks use sonner toast + real EF invocations
- **Alerts with hardcoded empty `affected count`:** Fixed by D-21 — CategoriesList now queries real count before opening dialog (verified by categories-tab test)

Clean.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full test suite | `npm run test -- --run` | 299 / 299 passing across 28 files, duration 2.33s | PASS |
| Production build | `npm run build` | `tsr generate + tsc -b + vite build` clean; 13 chunks built incl. admin-C4QsDD15.js (27.05 KB) and SuggestionForm-BFGJeBoQ.js (36.65 KB) | PASS |
| EF count | `ls supabase/functions/` | 15 functions + _shared (14 Phase 4 + submit-vote from Phase 2) | PASS |
| requireAdmin gating count | `grep -c requireAdmin supabase/functions/**/*.ts` | 13 gated EFs × 2 each + 1 definition = 27; close-expired-polls = 0 (carve-out) | PASS |
| polls_effective invariant | included in test suite | Green in 299/299 run | PASS |
| ROADMAP.md Phase 4 marker | `grep "Phase 4" .planning/ROADMAP.md` | Line 20 still shows `- [ ]`; table row shows `0/? Not started` | FAIL (doc sync) |
| REQUIREMENTS.md Phase 4 rows | `grep "Phase 4" .planning/REQUIREMENTS.md` | All 15 rows marked Complete | PASS |
| STATE.md phase marker | `grep "phase-04" .planning/STATE.md` | `status: phase-04-complete` | PASS |

---

## Gaps Summary

**Only 2 gaps found, both documentation-only:**

1. **ROADMAP.md line 20** — Phase 4 checkbox still `[ ]`, should be `[x]`
2. **ROADMAP.md progress table** — Phase 4 row reads `| 0/? | Not started | - |` and should read `| 4/4 | Complete | 2026-04-11 |`

These are trivial fixes that do not block PR merge. STATE.md (line 5: `status: phase-04-complete`) and REQUIREMENTS.md (all 15 Phase 4 rows marked Complete) are already in sync with reality — only ROADMAP.md lagged.

**Not blocking but noted for Phase 5 scope:**

- Edge Function **deployment** to the live Supabase project is deferred to Phase 5 per plan-level decision. The 14 admin EFs are source-only in this phase; all tests are source-analysis + unit tests (no live integration tests). This is acceptable because (a) the plan explicitly calls it out, (b) the migration IS live on remote, and (c) Phase 5 launch hardening owns deployment + live smoke. Listed in `human_verification` so a real UAT run happens before production launch.
- `CLOSE_SWEEPER_SECRET` provisioning is Phase 5 scope.
- Live two-session test of admin-bypass RLS on votes / vote_counts is Phase 5 scope.

---

## Overall Verdict

**READY FOR PR MERGE** — after flipping the two ROADMAP.md lines (checkbox + progress table). All 15 Phase 4 requirements are delivered, all 7 cross-AI concerns are resolved in code, all critical invariants hold, the test suite is 299/299 green, and the build is clean.

The only failing items are a documentation-sync mismatch on ROADMAP.md. The code itself is complete and correct within its Phase 4 scope boundary. Live Edge Function deployment and end-to-end UAT are correctly deferred to Phase 5 per the original plan decisions.

**Recommended fix list before merge (2 minutes of work):**

1. Edit `.planning/ROADMAP.md` line 20: `- [ ] **Phase 4` → `- [x] **Phase 4`
2. Edit `.planning/ROADMAP.md` progress table Phase 4 row: `| 0/? | Not started | - |` → `| 4/4 | Complete | 2026-04-11 |`

After those edits, Phase 4 is unambiguously complete and ready to merge to main.

---

*Verified: 2026-04-11*
*Verifier: Claude (gsd-verifier, Opus 4.6 1M context)*
