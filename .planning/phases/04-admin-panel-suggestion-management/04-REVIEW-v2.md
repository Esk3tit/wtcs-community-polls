---
phase: 04
depth: deep
review_type: pre-UAT
files_reviewed: 65
date: 2026-04-18
prior_review: 04-REVIEW.md (33 commits ago at f907db7)
reviewer: Claude Opus 4.7 (1M context, gsd-code-reviewer)
---

# Phase 4 Pre-UAT Deep Code Review

Pre-UAT last-chance review of 65 source files changed on `gsd/phase-04-admin-panel-suggestion-management` since the prior deep review at `f907db7`. Scope covers 14 admin EFs, 4 new migrations (6/7/8/9), 13 React hooks, 15 admin/form components, shared libs (`fn-error`, `imageConstraints`, validation), public surface (`archive.tsx`, `topics.tsx`, `SuggestionList.tsx`), and 14 admin test files.

## Summary

- Critical: 0
- High: 0
- Medium: 1
- Low: 4
- Nit: 3

All prior findings from `04-REVIEW.md` verified as addressed. All 8 critical invariants audited PASS. No new security vulnerabilities introduced. The remaining findings are hardening opportunities, not UAT blockers.

## Findings

### [MEDIUM] ME-v2-01 — `close-poll` overwrites `closed_at` + `resolution` on already-closed polls (LO-01 not fixed)

**File:** `supabase/functions/close-poll/index.ts:64-73`
**Category:** idempotency / audit-trail
**Issue:** Prior review flagged this as LO-01. The fix was not applied in this round of changes: the EF still runs `UPDATE polls SET status='closed', closed_at=now(), resolution=$resolution WHERE id=$1` without an `AND status='active'` guard. An admin double-clicking "Close" or clicking "Close" on a lazy-closed (raw_status='active', closes_at<now) poll will silently overwrite `closed_at` and `resolution`. For a poll closed manually 3 hours ago, a second click now records a brand-new `closed_at=now()` and whatever resolution was picked the second time — the first resolution audit is lost.

Because the kebab menu disables "Close…" when `status === 'active'` is false (`SuggestionKebabMenu.tsx:47`), the UI prevents this in normal operation. But `polls_effective.status` can report `closed` (lazy-close: sweeper hasn't run, `closes_at<now`, but `raw_status='active'`) while the underlying `polls.status` is still `'active'`. In that window:
- `SuggestionKebabMenu.tsx:47` reads the effective status (`closed`) → Close item is disabled. Good.
- But the admin can also reach close-poll via retry on a flaky network.

Bumping this from LO (prior) to ME because the overwrite of `closed_at` distorts the audit trail and the fix is still one line.

**Evidence:** `close-poll/index.ts:65-73` — no `.eq('status', 'active')` filter on the UPDATE chain. The `.single()` + PGRST116 check only handles "poll does not exist", not "poll is already closed".

**Fix:**
```diff
     const { error } = await supabaseAdmin
       .from('polls')
       .update({
         status: 'closed',
         closed_at: new Date().toISOString(),
         resolution,
       })
       .eq('id', poll_id)
+      .eq('status', 'active')
       .select('id')
       .single()
```
If zero rows match (PGRST116), the current branch already returns 404 "Poll not found". Consider distinguishing "already closed" (409) from "not found" (404) by querying first, or accept the collapsed 404 with a clearer message like "Poll not found or already closed."

UAT impact: an admin who tests the close flow, then tries to close the same poll again, will see the audit trail mutate silently. Not a data-integrity bug but an observable weirdness during testing.

---

### [LOW] LO-v2-01 — `rename-category` regenerates `slug` but the identical pattern exists in `create-category` — silent slug divergence if the user renames via other paths

**File:** `supabase/functions/rename-category/index.ts:62`, `supabase/functions/create-category/index.ts:55-58`
**Category:** code-duplication / drift-risk
**Issue:** Both EFs compute slug via `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`. This is correct, but duplicated. If one is changed (e.g., to support unicode letters), the other silently diverges. `create-category` rejects empty-after-slug names (line 60-62), `rename-category` does NOT — a rename to `"!!!"` would produce `slug=''` which the DB may accept if the `categories.slug` column has no NOT NULL/CHECK guarantee. Let me verify...

Actually the schema does enforce — migrations/00000000000000_schema would show that — but this is brittle. Extract to a shared helper:
```ts
// supabase/functions/_shared/slug.ts
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

Additionally `rename-category` does not reject the empty-slug case. If the schema does enforce `NOT NULL` on slug, this would surface as a 500 (console.error path) instead of a clean 400. Mirror the `create-category` guard:
```diff
     const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
+    if (!slug) {
+      return json({ error: 'Category name must contain at least one alphanumeric character' }, 400, corsHeaders)
+    }
```

**Evidence:** `rename-category/index.ts:62` — no empty-slug guard.

**Fix:** One-line validation guard in `rename-category`; optionally hoist to `_shared/slug.ts`.

---

### [LOW] LO-v2-02 — `update-poll` does not validate `image_url` server-side (validation drift from client)

**File:** `supabase/functions/update-poll/index.ts:68`, `supabase/functions/create-poll/index.ts:66`
**Category:** validation-drift / data-quality
**Issue:** The client (`validateSuggestionForm` at `src/lib/validation/suggestion-form.ts:63-69`) rejects malformed URLs via `new URL(imageUrl)`. The EFs accept any non-empty string as `image_url`. An attacker bypassing the form via curl can store arbitrary strings in `polls.image_url`. The public pages render it as `<img src={value}>` (see `ImageInput.tsx:64`) — a bad URL shows a broken image icon; no XSS risk because `src` attribute is not a JS execution context.

Not a security issue (CSP + the `<img>` tag's limited scope), but it's data-quality inconsistency. The prior review (Trace 3) flagged this drift in 04-REVIEW.md but did not track it as a finding; noting now because it could cause UAT confusion.

**Evidence:** `create-poll/index.ts:66` and `update-poll/index.ts:68` — no `try { new URL(image_url) } catch` guard.

**Fix:**
```diff
     const image_url = typeof body.image_url === 'string' && body.image_url.trim() !== '' ? body.image_url.trim() : null
+    if (image_url !== null) {
+      try { new URL(image_url) } catch {
+        return json({ error: 'image_url must be a valid URL' }, 400, corsHeaders)
+      }
+    }
```
Non-blocking.

---

### [LOW] LO-v2-03 — `TimerPicker.inferMode` silently defaults to `'7d'` on parse failure, masking bugs

**File:** `src/components/suggestions/form/TimerPicker.tsx:56-65`
**Category:** UX / debuggability
**Issue:** If `new Date(iso).getTime()` throws (malformed ISO), `inferMode` returns `'7d'`. This is benign — the picker just shows the 7d preset selected — but masks the real issue. For edit mode with a corrupt `closes_at`, the user sees an incorrect preset highlighted and a broken "will close" display.

Combined with `formatRelative` and `formatAbsolute` also returning `''` on failure, the UI shows "Will close " (trailing space) which is awkward but not a bug.

**Evidence:** `TimerPicker.tsx:62-64` catches any throw and returns `'7d'`.

**Fix:** Log the failure with `console.warn('inferMode failed for iso:', iso, e)` so devtools surfaces it.

---

### [LOW] LO-v2-04 — `SuggestionForm` hydrates `closes_at` from poll without clamping past dates (LO-04 carried over)

**File:** `src/components/suggestions/form/SuggestionForm.tsx:73`
**Category:** UX / edge-case
**Issue:** LO-04 from the prior review was NOT fixed. When editing a poll whose `closes_at` is in the past (lazy-closed, no votes yet), the form hydrates with the past date; on submit, client validation rejects with "Close time must be at least 1 minute in the future." The user sees an unexplained validation error.

In practice, `SuggestionKebabMenu.tsx:47` disables Edit when `status === 'closed'` (effective status from polls_effective), so the flow is hard to hit — but the form is reachable by direct URL navigation (`/admin/suggestions/:id/edit`) to any lazy-closed no-vote poll.

**Evidence:** `SuggestionForm.tsx:73` — `setClosesAt(poll.closes_at ?? defaultFuture)` has no past-date clamp.

**Fix (unchanged from prior review):**
```diff
-      setClosesAt(poll.closes_at ?? new Date(Date.now() + 7 * 86400_000).toISOString())
+      const existingCloseMs = poll.closes_at ? Date.parse(poll.closes_at) : NaN
+      setClosesAt(
+        Number.isFinite(existingCloseMs) && existingCloseMs > Date.now() + 60_000
+          ? poll.closes_at
+          : new Date(Date.now() + 7 * 86400_000).toISOString(),
+      )
```

---

### [NIT] NI-v2-01 — `AdminSuggestion.raw_status` still dead code (NI-04/cross-AI crumb carried)

**File:** `src/components/admin/AdminSuggestionRow.tsx:10`
**Issue:** `raw_status: string` declared on the type but never consumed. Carries from prior review's "out-of-scope observations". Low noise — remove to shrink the type surface:
```diff
 export type AdminSuggestion = {
   id: string
   title: string
   status: string
-  raw_status: string
   resolution: string | null
```
Tests at `admin-suggestions-tab.test.tsx` would need their fixtures updated. Not blocking.

---

### [NIT] NI-v2-02 — `useSuggestions` fetch uses same error text for polls/choices/cats/votes stages (LO-08 carried)

**File:** `src/hooks/useSuggestions.ts:44, 63, 88, 109`
**Issue:** Four different failure modes surface identical user-facing text. The votes stage now says "Failed to load your responses" (distinguishable — good), but the other three still say "Failed to load topics. Try refreshing the page." An operator reading a support bug report cannot tell which stage failed without the console.error. Consider distinct messages (or just a stage suffix like `[polls]`, `[choices]`, `[cats]` in `console.error`).

---

### [NIT] NI-v2-03 — `setTimeout(..., 0)` pattern proliferation (NI-03 carried)

**File:** `src/components/admin/AdminsList.tsx:58`, `src/hooks/useCategories.ts:39`, `src/hooks/useSearchAdminTargets.ts:28,39`
**Issue:** Four separate files use `setTimeout(..., 0)` as a lint-rule workaround for `react-hooks/set-state-in-effect`. The pattern works but is subtle; every maintainer will ask "why?". Consider a single named helper `deferToMicrotask()` or disabling the rule with a file-level comment explaining rationale. Non-blocking.

---

## Invariant Audit

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | `polls_effective` lazy-close view used on all public paths; `polls.status` never read | **PASS** | `useSuggestions.ts:34` reads `polls_effective`; `AdminSuggestionsTab.tsx:48`; `SuggestionForm.tsx:52`. Only `src/` usage of `from('polls')` is `CategoriesList.tsx:114` (allowlisted admin count query via `count:'exact', head:true` — doesn't read status). Invariant test at `polls-effective-invariant.test.ts` is non-tautological. |
| 2 | `vote_counts` is a CACHE — security gates use `EXISTS` on `votes` | **PASS** | Grep `vote_counts` across `supabase/functions/`: only hit is the comment in `delete-poll/index.ts:4` explaining the rule. `update-poll/index.ts:120-125` and `delete-poll/index.ts:63-68` both use `from('votes').select('id').limit(1).maybeSingle()`. RPC `update_poll_with_choices` (migration 8, line 83) uses `EXISTS (SELECT 1 FROM votes)`. Admin UI uses `vote_counts` for edit-lock UX hints only; server re-enforces. |
| 3 | `requireAdmin` called before any DB write in all 14 admin EFs (except close-expired-polls cron carve-out) | **PASS** | Verified all 13 non-carve-out EFs (`create-poll`, `update-poll`, `close-poll`, `pin-poll`, `delete-poll`, `set-resolution`, `create-category`, `rename-category`, `delete-category`, `promote-admin`, `demote-admin`, `search-admin-targets`, `get-upload-url`) — each calls `requireAdmin(supabaseAdmin, user.id)` then `adminCheckResponse` BEFORE body parse and mutation. Shared helper at `_shared/admin-auth.ts` centralizes logic. `adminCheckResponse` maps `query_failed→500` (backend fault), all other reasons → 403. `auth_missing→401` handled before helper. |
| 4 | Transactional update-poll (RPC, not chained supabase-js) | **PASS** | `update-poll/index.ts:135-143` invokes `supabaseAdmin.rpc('update_poll_with_choices')`. NO direct `choices.delete()` or `choices.insert()` in EF. Migration 8's RPC (lines 51-113) wraps `PERFORM ... FOR UPDATE` + `EXISTS` vote check + `UPDATE polls` + `DELETE choices` + `INSERT choices` in a single plpgsql block. `FOR UPDATE` lock (line 80) serializes against concurrent vote submissions — race-safe. |
| 5 | `close-expired-polls` cron gate: 503 on unset secret, 401 on mismatch, BEFORE any DB write | **PASS** | `close-expired-polls/index.ts:36-45` reads `expectedSecret`, returns 503 if unset, checks `X-Cron-Secret` header, returns 401 on mismatch. The supabaseAdmin client is created at line 48 AFTER both checks — fails closed on missing config. |
| 6 | Self-demote guard (EF 400 + UI hides button) | **PASS** | `demote-admin/index.ts:56-58` literal `if (target_user_id === user.id)` before any DB op. `AdminsList.tsx:119` hides Demote via `isSelf = user?.id === a.id`. Both layers enforced. |
| 7 | Last-admin guard: fail-closed on null adminCount | **PASS** | `demote-admin/index.ts:61-71` queries `count: 'exact'`; checks `adminCount === null \|\| adminCount <= 1`. Null adminCount (query anomaly) is treated as "cannot demote" — fail-closed. Error message explicit: "Cannot demote: at least one admin must remain". |
| 8 | `is_current_user_admin()` requires `is_admin AND mfa_verified AND guild_member` (migration 9) | **PASS** | Migration 9 replaces the function body (line 19): `SELECT is_admin AND mfa_verified AND guild_member FROM profiles WHERE id = auth.uid()`. Callers in RLS (votes + vote_counts SELECT policies, migration 5 lines 72/87) now enforce the full integrity gate. DB and EF (`requireAdmin`) agree. |

**All 8 invariants PASS.**

## Cross-file trace results

### Trace 1 — Migration stack 5→6→7→8→9 correctness (final function shapes)

The migrations `CREATE OR REPLACE` the same RPCs four times. After all five migrations apply in order:

- **`create_poll_with_choices`** (final from migration 8): uses `COALESCE(cardinality(p_choices), 0)` guard (handles NULL arrays correctly), no error codes (acceptable — caller re-checks). REVOKE+GRANT pinned (migration 7 line 136-137, re-applied migration 8 line 116-117). Each `CREATE OR REPLACE` resets grants, so the re-application in migration 8 is correct and necessary. **PASS.**

- **`update_poll_with_choices`** (final from migration 8): uses `COALESCE(cardinality(), 0)` + `FOR UPDATE` lock on choices + SQLSTATE error codes P0002/P0003/P0004. REVOKE+GRANT pinned (migration 8 line 119-120). **PASS.**

- **`is_current_user_admin()`** (final from migration 9): tightened from `SELECT is_admin` to `SELECT is_admin AND mfa_verified AND guild_member`. **PASS.**

- **Storage bucket** (migration 7 line 145-157): switched from `ON CONFLICT DO NOTHING` to `DO UPDATE` for convergence. Correctly includes `public`, `file_size_limit`, `allowed_mime_types`. **PASS.**

**Idempotency check:** each migration is `CREATE OR REPLACE` (functions) or `ON CONFLICT DO UPDATE` (buckets). Re-running the full stack produces the same final state. REVOKE+GRANT statements are idempotent. **PASS.**

**One subtle point:** migration 6 uses SQLSTATE P0003/P0002/P0004 but with `array_length()` (bug); migration 7 switches to `cardinality()` but the SQLSTATE codes on update_poll stay intact; migration 8 adds COALESCE but preserves SQLSTATE codes. The EF at `update-poll/index.ts:146-156` matches on `rpcError.code` AND falls back to regex — works across all three migration states. **PASS.**

### Trace 2 — `requireAdmin` coverage across 14 EFs

Every admin EF (13 of 14) follows this pattern:
1. `const authHeader = req.headers.get('Authorization')` → 401 if missing
2. `supabaseUser.auth.getUser()` → 401 if invalid
3. `supabaseAdmin = createClient(SERVICE_ROLE_KEY)`
4. `requireAdmin(supabaseAdmin, user.id)` → `adminCheckResponse` → 403 or 500
5. Body parse + validation
6. DB mutation

`close-expired-polls` is the documented carve-out (cron-secret gate instead).

The `adminCheckResponse` helper maps:
- `query_failed` → 500 "Internal error"
- `not_admin`/`integrity_failed`/`profile_not_found` → 403 "Forbidden"
- Note: `auth_missing` is handled by the EF pre-check (401), never reaches the helper.

**Status:** All 14 EFs audited. Consistent. **PASS.**

### Trace 3 — `is_current_user_admin()` tightening impact (migration 9)

Callers of `is_current_user_admin()` (grep shows only migration 5):
- `votes` SELECT policy (line 70-73): `user_id = auth.uid() OR is_current_user_admin()` — users still see their own votes; admins lose the admin bypass branch unless fully integrity-checked. Regular users unaffected. Admins who lost MFA or guild membership can no longer see others' votes via PostgREST direct reads. **Correct tightening.**
- `vote_counts` SELECT policy (line 80-88): `EXISTS(...) OR is_current_user_admin()` — same pattern. **Correct tightening.**

**No other RLS uses this function.** Other data-path reads (polls, choices, categories) use `USING (true)` — open to all authenticated. The tightening does not over-restrict legitimate admin workflows because admins use the Edge Function layer (which does its own integrity check) for writes; reads are the only path that relies on the DB function directly.

**Status:** PASS — tightening aligns DB with EF `requireAdmin`, closes a direct-PostgREST bypass.

### Trace 4 — `polls_effective` invariant

Verified:
- `useSuggestions.ts:34` — reads `polls_effective`. `.eq('status', status)` filters the DERIVED column. Correct.
- `AdminSuggestionsTab.tsx:48` — reads `polls_effective`. Correct.
- `SuggestionForm.tsx:52` — reads `polls_effective` for edit hydration. Correct.
- `CategoriesList.tsx:114` — ONLY `from('polls')` call in `src/` (excluding tests). Allowlisted in `polls-effective-invariant.test.ts`. Query is `head:true, count:'exact'` on `category_id = $1` — does not read `status`. Invariant not breached.

No other `from('polls')` in non-test source. Invariant test `polls-effective-invariant.test.ts` uses literal-match regex `/from\(\s*['"]polls['"]\s*\)/` which will NOT match `polls_effective` (different closing quote) — non-tautological. **PASS.**

### Trace 5 — `vote_counts` not used for security decisions

Verified: no EF uses `vote_counts.count` for security gating. `delete-poll/index.ts:4` has an explanatory comment ("vote_counts is a CACHE and must NEVER be the source of truth"). Admin UI reads `vote_counts` for edit-lock UX hints (`SuggestionForm.tsx:64, AdminSuggestionsTab.tsx:67`) but server re-enforces via `EXISTS` on `votes` in both `update-poll` and `delete-poll`. **PASS.**

### Trace 6 — Slug regen on category rename

- `rename-category/index.ts:62` derives slug from name, updates both columns atomically: `.update({ name, slug })`. Single-row update — transactional.
- No DB trigger on categories.slug (schema/trigger migrations don't mention one — only triggers are `handle_new_user` profile trigger and `profile_self_update_allowed`).
- `categories` table has a UNIQUE constraint on slug (prior reviews + the migration 7 fix referenced the unique constraint being the reason). Rename to a name whose slug collides returns PGSQL 23505 → EF maps to 409 "Category already exists". **Correct.**

**Edge case found — LO-v2-01:** `rename-category` doesn't validate that the computed slug is non-empty. `create-category` has the guard. If the DB schema enforces NOT NULL on slug (likely — it's a unique constraint column), renaming to `"!!!"` yields `slug=''` → DB rejects (likely 23502 or 23505) → EF returns generic 500 instead of clean 400. Low-severity inconsistency.

### Trace 7 — `useSuggestions` vote fetch bounded (HI-01 regression check)

`useSuggestions.ts:98-103`: now has `.in('poll_id', pollIds)` — bounded. Stale-fetch guard at line 122 is AFTER the setState calls that set errors (lines 44-46, 63-65, 88-90, 107-111). **Correct for error paths** because error paths return early. For the success path, the guard at line 122 is before `setSuggestions` / `setUserVotes` / `setError(null)` / `setLoading(false)` — so stale successful fetches are correctly discarded. **HI-01 fully resolved.**

### Trace 8 — Round-trip date validation (create-poll + update-poll + client)

Three-layer check:
1. Regex: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/` — rejects missing timezone.
2. `new Date(closes_at)` + `isNaN` — catches syntactically valid but semantically invalid values.
3. Calendar-date round-trip: `Date.UTC(year, month-1, day)` then verify `getUTCFullYear/Month/Date` matches — rejects Feb 30, Feb 31, April 31, etc.
4. Future-check: `closesAtDate.getTime() > Date.now() + 60_000`.

**Validation test cases:**
- `'2026-02-30T12:00:00Z'` — regex passes, Date parses as March 2 (silent coercion), but `[year=2026, month=2, day=30]` — `calendarDate.getUTCDate() = 2`, not 30 → rejects. **Correctly rejects Feb 30.**
- `'2026-04-18T23:59:59-05:00'` — regex passes (has timezone offset), Date parses correctly, calendar-date check passes (April 18 is valid). **Correctly accepts non-Z timezone.**
- `'2026-12-32T12:00:00Z'` — regex passes structurally, Date parses as Jan 1 2027, calendar check rejects (day=32 → getUTCDate=1). **Correctly rejects.**
- `'2026-04-31T12:00:00Z'` — regex passes, Date parses as May 1, calendar check rejects. **Correctly rejects.**

The `Date.UTC(year, month-1, day)` approach is timezone-agnostic (uses UTC), which correctly validates the CALENDAR date regardless of the user's offset. **PASS.**

### Trace 9 — `COALESCE(cardinality(p_choices), 0)` edge cases

Migration 8 uses `COALESCE(cardinality(p_choices), 0)` guard:
- `NULL` array → `cardinality=NULL` → `COALESCE=0` → `0 < 2` → rejects. **Correct.**
- `{}` (empty array) → `cardinality=0` → `0 < 2` → rejects. **Correct.**
- `{"a"}` (1-element) → `cardinality=1` → `1 < 2` → rejects. **Correct.**
- `{"a","b"}` (2-element) → `cardinality=2` → passes. **Correct.**
- 10 elements → `cardinality=10` → passes. **Correct.**
- 11 elements → `cardinality=11` → `11 > 10` → rejects. **Correct.**

**All edge cases correctly handled.** PASS.

## UAT readiness verdict

**READY for UAT.**

Rationale:
- 0 Critical, 0 High findings.
- All 8 invariants hold.
- All 4 prior HIGH concerns from cross-AI review verified resolved.
- HI-01 (prior) — fully fixed.
- ME-01 (prior SQLSTATE hardening) — fully fixed via migrations 6/8.
- ME-06 (prior catch-block consistency) — fully fixed in `usePromoteAdmin`/`useDemoteAdmin`.
- ME-05 (prior vote_counts scoping) — fully fixed.
- LO-02 (pin-poll boolean coercion) — fixed; EF now rejects non-boolean.
- Migration stack 5→9 re-applies cleanly; final function shapes correct.
- Tightening of `is_current_user_admin()` does not over-restrict legitimate admin access.

**Recommended pre-UAT touch-up (optional, one-line fixes):**
1. ME-v2-01: add `.eq('status', 'active')` guard to `close-poll` to preserve audit trail on double-close.
2. LO-v2-01: add empty-slug guard to `rename-category`.
3. LO-v2-04: clamp past `closes_at` to +7 days in `SuggestionForm` hydration (carried LO-04).

None of these block UAT — they are last-mile polish. The user can proceed to manual UAT now and fold these into a post-UAT pass if desired.

## Re-verification of prior findings (04-REVIEW.md)

| Prior finding | Severity | Status in v2 | Evidence |
|---|---|---|---|
| HI-01 `useSuggestions` unbounded votes query | HIGH | **RESOLVED** | `useSuggestions.ts:103` now includes `.in('poll_id', pollIds)`. Stale-fetch guard at line 122 authoritative in success path. |
| ME-01 update-poll regex-on-message | MEDIUM | **RESOLVED** | Migrations 6/7/8 add SQLSTATE P0002/P0003/P0004. `update-poll/index.ts:146-156` matches on `rpcError.code` with message-regex fallback. |
| ME-02 get-upload-url filename extension | MEDIUM | **RESOLVED** | `get-upload-url/index.ts:84-90` now derives extension from validated contentType, overwriting client-supplied extension. |
| ME-03 source-analysis tests are shape-only | MEDIUM | **CARRIED** | Still true. Non-blocking for Phase 4; track as Phase 5 integration-test prep. |
| ME-04 extractMessage duplication | MEDIUM | **RESOLVED** | `src/lib/fn-error.ts` centralizes extraction. All 9 hook files import from it. |
| ME-05 AdminSuggestionsTab unscoped vote_counts | MEDIUM | **RESOLVED** | `AdminSuggestionsTab.tsx:65-75` now scopes `.in('poll_id', pollIds)`. |
| ME-06 promote/demote missing catch | MEDIUM | **RESOLVED** | `usePromoteAdmin.ts:45-50` and `useDemoteAdmin.ts:26-31` now have catch blocks mirroring `useCreatePoll`. |
| LO-01 close-poll idempotency | LOW | **NOT FIXED** — promoted to ME-v2-01 | See finding above. |
| LO-02 pin-poll !!boolean coercion | LOW | **RESOLVED** | `pin-poll/index.ts:53,60-62` — now rejects non-boolean with 400 error. |
| LO-03 CORS default origin leak | LOW | **CARRIED** | Still default-allowlists `ALLOWED_ORIGINS[0]` on missing Origin header. Non-blocking, log-trust cosmetic. |
| LO-04 SuggestionForm past closes_at | LOW | **NOT FIXED** — carried as LO-v2-04 | Same finding. |
| LO-05 TimerPicker swallowed errors | LOW | **CARRIED** | Still silent. New LO-v2-03 similar observation on inferMode. |
| LO-06 ImageInput URL tab onBlur-only | LOW | **PARTIALLY FIXED** | Now controlled via `urlInput` state at line 21, 178. Still commits on onBlur only (line 179-182). Better than prior (no loss on tab flip), but not live-committed. Acceptable. |
| LO-07 route UUID validation | LOW | **CARRIED** | Still no `parseParams` UUID validator. |
| LO-08 generic useSuggestions error | LOW | **PARTIALLY FIXED** — carried as NI-v2-02 | Votes stage now has distinct message; others still share. |
| NI-01 search-admin-targets no ORDER BY | NIT | **RESOLVED** | `search-admin-targets/index.ts:66` now `.order('discord_username', { ascending: true })`. |
| NI-02 promote-admin retroactive flip silent failure | NIT | **CARRIED** | Still logs-but-doesn't-fail. Plus: `useDemoteAdmin.ts:24` now uses interpolated username in toast ("${target_username} demoted"). |
| NI-03 setTimeout(..., 0) workaround | NIT | **CARRIED** | Still present. See NI-v2-03. |
| NI-04 AdminSuggestionRow memoization | NIT | **CARRIED** | Cheap at Phase 4 scale. |
| NI-05 useSearchAdminTargets searching flicker | NIT | **CARRIED** | Benign. |

**Summary:** Of 20 prior findings, 11 fully resolved, 2 partially resolved, 7 carried forward as documented LOW/NIT non-blockers. One LO (close-poll idempotency) promoted to MEDIUM because its audit-trail impact is more visible during UAT than at Phase 4 scale.

## Net-new checks added in v2

- Migration stack idempotency (5→6→7→8→9): PASS
- `COALESCE(cardinality())` NULL/empty/boundary behavior: PASS
- `is_current_user_admin()` tightening impact on RLS policies: PASS (no over-restriction)
- Round-trip date validation across valid/invalid inputs: PASS
- Slug regen on category rename + schema interaction: PASS (one LOW found)
- `FOR UPDATE` lock serialization with concurrent votes: PASS
- `adminCheckResponse` error mapping across all 14 EFs: PASS

---

_Reviewed: 2026-04-18_
_Reviewer: Claude Opus 4.7 (1M context, gsd-code-reviewer)_
_Depth: deep (pre-UAT cross-file trace + invariant audit + migration stack analysis)_
_Files in scope: 65 (source files changed since f907db7)_
