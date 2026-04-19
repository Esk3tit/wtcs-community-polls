---
phase: 04
depth: deep
files_reviewed: 73
date: 2026-04-11
reviewer: Claude (Opus 4.6, 1M context)
---

# Phase 4 Code Review (Deep)

Deep cross-file code review of branch `gsd/phase-04-admin-panel-suggestion-management` vs `main`. 73 non-generated source files in scope (72 tracked + migration). Focus: invariant audit (polls_effective, vote_counts cache, requireAdmin-before-write, transactional update-poll, cron secret gate, self-demote guard), cross-file traces (EF to RPC/RLS, upload path, hook to EF), language-specific checks (TypeScript strict mode, React hook rules, Deno runtime, PL/pgSQL safety), and net-new defects not already raised in `04-REVIEWS.md`.

## Summary

- Critical: 0
- High: 1
- Medium: 6
- Low: 8
- Nit: 5

All six non-negotiable invariants pass audit. The one HIGH is a live functional regression in the public topics/archive read path (user-vote hydration pulls every vote row from `votes` on every poll load, and the stale-fetch guard is wired incorrectly — see HI-01). Everything else is either defense-in-depth tightening (error messages, CORS, edge cases) or test-coverage gaps that do not block merge. No security vulnerabilities found. No data-integrity risks beyond the already-resolved cross-AI HIGH #1 (update-poll transactional). The prior cross-AI HIGH/MEDIUM concerns are all verified as fixed.

## Findings

### [HIGH] HI-01 — useSuggestions fetches ALL user vote rows on every reload and the stale-fetch guard is placed after the vote fetch

**File:** `src/hooks/useSuggestions.ts:96-118`
**Category:** correctness / performance / data-integrity (minor)
**Issue:** Two distinct problems in the same block:

1. The votes query `supabase.from('votes').select('poll_id, choice_id').eq('user_id', user.id)` filters on user only — it does NOT restrict to the currently-fetched `pollIds`. For a user who has voted on many polls across the archive and topics pages, this pulls every vote row the user has ever cast on every mount of either page, then the merge silently ignores the ones that don't match a poll in view. This grows unboundedly over time — a latent perf issue today, a correctness issue the moment a page starts using `userVotes.get(pollId)` semantics that assume completeness (e.g. "user voted anywhere").
2. The effect's stale-fetch guard is `if (fetchRef.current !== fetchId) return` at line 118, but it is checked only AFTER all four awaits (polls, choices, cats, votes). If `status` or `user` changes mid-flight, the earlier awaits' `setState` calls inside the error branches (lines 44-46, 63-65, 88-90, 107-109) execute unconditionally because they precede the guard and only consult `cancelled`, which the outer closure clears via cleanup. That is fine for cleanup-ordering, but the guard's `fetchId` vs `fetchRef.current` check is effectively dead code in the happy path — the `cancelled` flag from the cleanup closure already handles staleness. The `fetchTrigger` / `fetchId` pairing is a leftover from an earlier version; either make it authoritative or delete it.

**Evidence:** See lines 23-24 (`fetchTrigger`, `fetchRef`), 96-115 (votes query without pollIds filter), 117-118 (stale guard at end of happy path), 132-134 (effect deps include `user`). Note also that `vote_counts.count` is correctly NOT used as a security boundary — the file is a pure read path. No invariant breach, only correctness/perf.

**Fix:**
```diff
-      // 4. User votes
-      let votesMap = new Map<string, string>()
-      if (user) {
+      // 4. User votes — scope to the polls actually in view so the payload
+      //    stays bounded and the map only contains relevant keys.
+      let votesMap = new Map<string, string>()
+      if (user && pollIds.length > 0) {
         const { data: votes, error: votesError } = await supabase
           .from('votes')
           .select('poll_id, choice_id')
-          .eq('user_id', user.id)
+          .eq('user_id', user.id)
+          .in('poll_id', pollIds)
```

Optionally, delete the `fetchTrigger` / `fetchRef` dance and rely solely on the `cancelled` closure flag — or flip the order so the fetchRef guard runs before `setState`. As-is, the two mechanisms overlap without either being load-bearing.

**Why HIGH and not MEDIUM:** this is net-new code on the public read path that every signed-in user hits twice per navigation. The unbounded vote pull is cheap today but compounds with no cap as vote history grows and will silently blow through the Supabase free-tier egress ceiling long before it is obvious in a load test. The 1-line `.in('poll_id', pollIds)` addition makes it correct and forward-proof.

---

### [MEDIUM] ME-01 — update-poll pre-check uses `maybeSingle()` but without `.select('id').limit(1)` semantics (minor race window)

**File:** `supabase/functions/update-poll/index.ts:97-109`
**Category:** data-integrity / race
**Issue:** The EF pre-check runs `.from('votes').select('id').eq('poll_id', poll_id).limit(1).maybeSingle()` to return a clean 409 before calling the RPC. The RPC itself re-checks `EXISTS (SELECT 1 FROM votes WHERE poll_id = p_poll_id)` inside the plpgsql block (`migrations/00000000000005_admin_phase4.sql:171-173`). Both are correct in isolation.

However, there is a small TOCTOU window: a vote that arrives between the pre-check and the RPC invocation would be caught by the RPC's re-check and raised as an exception. The EF does map `/responses already received/i` to 409 in the error-handling branch at lines 123-125, so the end-user surface is correct. But the regex match on `rpcError.message` is fragile — if the RPC ever changes its error text, the EF will silently return a 500 instead of 409.

**Evidence:** `update-poll/index.ts:124`: `if (typeof rpcError.message === 'string' && /responses already received/i.test(rpcError.message))`. The string comparison to `Poll not found` at line 127 is equally fragile.

**Fix:** Raise the RPC exceptions with a stable SQLSTATE instead of a free-form message, e.g.:
```sql
RAISE EXCEPTION 'Cannot update poll: responses already received'
  USING ERRCODE = 'P0001', HINT = 'edit_lock_violated';
```
Then match on `rpcError.code === 'P0001'` in the EF. Alternatively, accept the coupling but add a comment that any rename of the RAISE text must be mirrored in the EF.

---

### [MEDIUM] ME-02 — get-upload-url sanitizer collapses empty/all-invalid filenames to `"upload"` but does NOT enforce a filename extension

**File:** `supabase/functions/get-upload-url/index.ts:22-27`, plus `supabase/migrations/00000000000005_admin_phase4.sql:208-216`
**Category:** validation / content negotiation
**Issue:** The sanitizer strips everything except `[A-Za-z0-9._-]` and falls back to `"upload"` if empty. That's fine for path safety, but:
1. A client can upload `"foo.exe"` and as long as `contentType === 'image/jpeg'` it will pass. The storage bucket's MIME allowlist is enforced on contentType, not the final filename extension — Supabase Storage enforces the MIME allowlist at PUT time against the claimed content-type. So the on-disk object is stored as whatever name the client supplied.
2. Since image URLs are then surfaced as public URLs rendered in `<img src>` (line 35 of `useUploadImage.ts`), a mismatched filename extension is cosmetic but can confuse downstream caching / CDN heuristics and will display oddly in admin tools that rely on the extension. Also some browsers sniff extensions in Content-Disposition contexts.
3. The validation in `useUploadImage.ts:8-11` enforces `file.type` against `ALLOWED_MIME`, which is browser-reported MIME. A sophisticated attacker with a hostile browser build can lie about `file.type`, but the EF's `contentType` check catches that at the signing step and Supabase Storage re-enforces it at PUT time. So this is NOT a security issue — just a UX/cosmetic nit on file naming.

**Evidence:** `get-upload-url/index.ts:66-68` validates `contentType` but only uses it for the signing call; the filename passed into the path is the sanitized `body.filename` with no extension coupling. `useUploadImage.ts:27-30` passes `contentType: file.type` to `uploadToSignedUrl` so the stored object's content-type is correct even if the filename is weird.

**Fix:** Either (a) derive the extension from the validated `contentType` and overwrite the filename extension server-side, or (b) document that the filename is a display-only hint and that content-type governs everything. Option (a) is one line:
```diff
+    const extFromMime = contentType === 'image/jpeg' ? 'jpg'
+      : contentType === 'image/png' ? 'png' : 'webp'
+    const baseName = sanitizeFilename(filename).replace(/\.[^.]+$/, '')
-    const path = `${crypto.randomUUID()}/${sanitizeFilename(filename)}`
+    const path = `${crypto.randomUUID()}/${baseName}.${extFromMime}`
```

---

### [MEDIUM] ME-03 — Source-analysis tests are shape-only; invariants depend on literal text survival

**File:** `src/__tests__/admin/admin-auth-coverage.test.ts:82-92`, `src/__tests__/admin/suggestion-crud-edge.test.ts:73-79`, `src/__tests__/admin/demote-admin.test.ts:27-29`, `src/__tests__/admin/lifecycle-edge.test.ts:22-24`
**Category:** test-quality / false confidence
**Issue:** Prior cross-AI review already flagged this (MEDIUM on `04-REVIEWS.md` line 119). The current implementation verifies code shape by grepping for regex patterns (e.g., `requireAdmin\s*\(`, `target_user_id\s*===\s*user\.id`). This catches accidental deletion of the literal but does not run the function with realistic input. Specifically:

1. `admin-auth-coverage.test.ts:82-92` uses `src.search(/requireAdmin\s*\(/)` and `src.match(/\.(insert|update|delete|rpc)/)`. This picks up the FIRST match in source order. A refactor that adds a `.select('count')` read BEFORE `requireAdmin` (e.g. a telemetry hit) would NOT be caught because `.select` is not in the regex. The guard is one-directional.
2. `demote-admin.test.ts:27` requires literal `target_user_id === user.id`. A refactor to `targetUserId === user.id` (camelCase) would silently disable the guard without failing the test, because the test regex is the literal exact syntax. The EF test reifies the plan's D-06 wording rather than the behavior.
3. `lifecycle-edge.test.ts:22-24` asserts `close-expired-polls` does NOT contain `requireAdmin` (intentional carve-out). If a future refactor adds `requireAdmin` under a separate branch, the test reverses polarity and begins to fail where it should succeed — but the failure is misleading because the carve-out is fine, it's the negative assertion that is brittle.

**Evidence:** See the referenced line ranges. All source-analysis tests work because the code does match the literals — but the tests provide an illusion of coverage. They catch REGRESSIONS (text getting deleted), not runtime bugs.

**Fix:** Add at least one integration test (Supabase local stack or a simple stub server) per critical admin flow: `create-poll success`, `update-poll refused with 409 after vote`, `demote-admin self-hit returns 400`, `get-upload-url rejects SVG contentType`. The cross-AI review already flagged this — track as Phase 5 prep. Non-blocking for merge.

---

### [MEDIUM] ME-04 — Floating promise in `extractMessage` swallows JSON parse errors

**File:** `src/hooks/useCreatePoll.ts:10-21`, `src/hooks/useUpdatePoll.ts:13-27`, `src/hooks/useDeletePoll.ts:12-26`, `src/hooks/useClosePoll.ts:9-20`, `src/hooks/usePromoteAdmin.ts:20-31`, `src/hooks/useDemoteAdmin.ts:9-20`, `src/hooks/usePinPoll.ts:9-20`, `src/hooks/useSetResolution.ts:9-21`, `src/hooks/useCategoryMutations.ts:9-20`
**Category:** error-handling
**Issue:** All nine hook files duplicate the same `extractMessage` helper with `catch { /* fall through */ }`. If `error.context.json()` rejects (malformed JSON from the EF, network failure mid-read), the catch silently consumes the failure and returns the fallback. That is intentional behavior but:

1. **Code duplication** — 9 copies of nearly identical `extractMessage` means any bug fix has to be propagated 9 times. Extract to `src/lib/fn-error.ts` or similar shared util.
2. In `useUpdatePoll.ts:27` and `useDeletePoll.ts:26` the helper returns `{ msg, status }` but the status is `undefined` if `ctx.json()` throws (because the try/catch wraps both reads). If the 409 status was already set from `ctx?.status` at line 17, the try fails partway through, `status` is still the 409 but the catch path resets... actually tracing it: `status = ctx?.status` runs BEFORE `ctx.json()` so `status` IS preserved across the json-parse failure. Good. No bug, just subtle enough to warrant a comment.

**Evidence:** 9 file paths above. Identical 12-line helper in each.

**Fix:** Extract to a shared module:
```ts
// src/lib/fn-error.ts
export async function extractFunctionError(
  error: unknown,
  fallback: string,
): Promise<{ msg: string; status: number | undefined }> {
  let status: number | undefined
  let msg = fallback
  try {
    const ctx = (error as { context?: { status?: number; json?: () => Promise<{ error?: string }> } })?.context
    status = ctx?.status
    if (ctx?.json) {
      const body = await ctx.json()
      if (body?.error) msg = body.error
    }
  } catch { /* fall through to fallback */ }
  return { msg, status }
}
```

---

### [MEDIUM] ME-05 — AdminSuggestionsTab re-fetches vote_counts on every filter change but does not memoize between tabs

**File:** `src/components/admin/AdminSuggestionsTab.tsx:21-50`
**Category:** UX / efficiency
**Issue:** `fetchAll` runs the full vote_counts query `supabase.from('vote_counts').select('poll_id, count')` with no filter on poll_ids. It sums ALL vote_counts rows across the entire table, then builds a lookup keyed by `poll_id`. For the "active" filter the vast majority of those rows are for closed polls the admin isn't currently viewing. Same concern as HI-01 but admin-side, smaller blast radius.

Also: on re-render after a mutation (via `onChanged`), the whole list refetches including vote_counts. No staleness tolerance.

**Evidence:** Lines 35-43. The query has no `.in('poll_id', pollIds)` filter.

**Fix:** Scope the vote_counts query to the visible poll IDs, mirroring HI-01's fix:
```diff
-      const { data: vcData, error: vcErr } = await supabase
-        .from('vote_counts')
-        .select('poll_id, count')
+      const pollIds = items.map((s) => s.id)
+      const { data: vcData, error: vcErr } = await supabase
+        .from('vote_counts')
+        .select('poll_id, count')
+        .in('poll_id', pollIds)
```
Note: the existing code runs the vc query BEFORE `setItems`, so you'd need to thread `pollIds` from the in-scope `data` variable. Trivial reorder.

---

### [MEDIUM] ME-06 — usePromoteAdmin returns `ok: true` from the outer try without a catch, so a thrown supabase-js error propagates uncaught

**File:** `src/hooks/usePromoteAdmin.ts:36-60`
**Category:** error-handling
**Issue:** Compare to `useCreatePoll.ts:31-50` which has a full `try { ... } catch { toast.error; return ok:false } finally { inflightRef = false }` pattern. `usePromoteAdmin.ts` has `try { ... } finally { setSubmitting(false) }` only — no catch. If `supabase.functions.invoke` throws synchronously (edge case: client built with a bad URL), the caller `PromoteAdminDialog.handlePromoteTarget` at `PromoteAdminDialog.tsx:28` gets an unhandled promise rejection because `await promote(...)` will reject, and the caller code doesn't wrap in try/catch. The toast is never shown and the UI looks frozen.

Same pattern in `useDemoteAdmin.ts:27-46`.

**Evidence:** `usePromoteAdmin.ts:37-60` — the outer `try` has no matching `catch`. The function only returns `{ ok: false }` from the `if (error)` branch; any throw skips both return statements.

**Fix:** Mirror the `useCreatePoll` pattern:
```diff
   const promote = useCallback(async (args: PromoteArgs) => {
     setSubmitting(true)
     try {
       const { data, error } = await supabase.functions.invoke<PromoteResponse>(
         'promote-admin',
         { body: args },
       )
       if (error) {
         toast.error(await extractMessage(error, 'Could not promote admin. Try again.'))
         return { ok: false as const }
       }
       ...
       return { ok: true as const, mode: data?.mode }
+    } catch {
+      toast.error('Could not promote admin. Try again.')
+      return { ok: false as const }
     } finally {
       setSubmitting(false)
     }
   }, [])
```
Apply the same fix to `useDemoteAdmin.ts`. In practice `supabase.functions.invoke` returns the error in the resolved envelope rather than throwing, so this is belt-and-suspenders — but the inconsistency with the sibling hooks is noise that will bite a future maintainer.

---

### [LOW] LO-01 — close-poll does not validate current poll state before transitioning to 'closed'

**File:** `supabase/functions/close-poll/index.ts:60-67`
**Category:** idempotency / state-machine
**Issue:** The EF unconditionally runs `UPDATE polls SET status='closed', closed_at=now(), resolution=... WHERE id=$1`. If the poll is already `'closed'`, this overwrites `closed_at` with a newer timestamp (mutating history) and accepts an unchanged resolution write. There is no `AND status = 'active'` guard. The cross-AI review already suggested idempotency on line 84-87 ("Consider making close-poll idempotent and validating status transitions explicitly").

The blast radius is small — only an admin can trigger it, and the worst case is a slightly-drifting `closed_at` if an admin double-clicks. But it's trivially hardenable.

**Evidence:** Lines 60-67 have no `.eq('status', 'active')` filter and no `.select()` return to confirm a row was updated.

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
+    .eq('status', 'active')
```
Then if zero rows match, return 409 or just let the `success: true` response stand (idempotent no-op). Alternatively use the RPC pattern.

---

### [LOW] LO-02 — `pin-poll` accepts any truthy `is_pinned` without schema-checking the type

**File:** `supabase/functions/pin-poll/index.ts:48-56`
**Category:** validation
**Issue:** Line 55: `.update({ is_pinned: !!body.is_pinned })`. The client can send `is_pinned: "false"` (string, truthy) and the pin will be SET instead of cleared. This is benign because the admin UI always sends booleans, but the EF signature accepts `is_pinned?: unknown` and converts via `!!`. A typo-prone API.

**Evidence:** Line 55 `!!body.is_pinned`.

**Fix:** `if (typeof body.is_pinned !== 'boolean') return json({ error: 'is_pinned must be boolean' }, 400, corsHeaders)`.

---

### [LOW] LO-03 — CORS helper returns the first allowlisted origin as a default

**File:** `supabase/functions/_shared/cors.ts:9`
**Category:** security hardening
**Issue:** `const resolvedOrigin = allowedOrigin ?? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])`. When the browser sends no Origin header or an unknown one, the function echoes `ALLOWED_ORIGINS[0]` (`'https://polls.wtcsmapvote.com'`). That's fine — but in a curl-from-backend context (no Origin header) the response carries an `Access-Control-Allow-Origin: https://polls.wtcsmapvote.com` header that is a lie. It won't cause browser XS-exposure because browsers require the origin to match exactly, but it does confuse log-ingest tools that trust the header at face value.

**Evidence:** Line 9.

**Fix:** When the request has no Origin (server-to-server), return no CORS headers at all:
```ts
if (!origin && !allowedOrigin) {
  return { 'Vary': 'Origin' }
}
```
Non-blocking.

---

### [LOW] LO-04 — `SuggestionForm` hydrates `closes_at` from loaded poll without checking it is still in the future

**File:** `src/components/suggestions/form/SuggestionForm.tsx:68-69`
**Category:** UX / edge-case
**Issue:** When editing a poll whose `closes_at` is in the past (e.g. a lazy-closed active poll that the sweeper hasn't processed), the form hydrates `setClosesAt(poll.closes_at)`. On submit, `validateSuggestionForm` then rejects with `'Close time must be in the future.'` and the user sees a validation error with no explanation of why — the date picker shows the existing close date unchanged. This is the lazy-close edge case: polls_effective reports `status='closed'` but `raw_status` is still `'active'`, so the edit button is enabled (it checks `s.status === 'closed'` → disabled). Wait, let me re-check — the kebab menu's editDisabled check is `hasVotes`, not status-based. So an admin could edit a lazy-closed no-vote poll, land on the form, and hit an unexplained past-close validation error.

**Evidence:** `SuggestionForm.tsx:68` hydrates `closes_at` without clamping. `SuggestionKebabMenu.tsx:42` disables edit on `hasVotes`, not on status. `suggestion-form.ts:35` rejects past closes_at.

**Fix:** In the hydration branch, if `closes_at` is in the past, reset to `+7 days`:
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

### [LOW] LO-05 — `TimerPicker.toLocalInput` silently swallows errors

**File:** `src/components/suggestions/form/TimerPicker.tsx:14-22`
**Category:** error-handling / debuggability
**Issue:** The try/catch returns `''` on any failure, which makes the native `<input type="datetime-local">` fall back to "no value". For a malformed ISO string the user sees an empty field with no hint why. Not blocking — the field is easy to refill — but a `console.warn` would help future debugging.

**Evidence:** Lines 14-22.

**Fix:** Log inside the catch: `console.warn('toLocalInput failed for', iso, e)`.

---

### [LOW] LO-06 — `ImageInput` URL tab only triggers onChange on blur, not on change

**File:** `src/components/suggestions/form/ImageInput.tsx:88-97`
**Category:** UX
**Issue:** The "Paste URL" tab uses `onBlur={(e) => onChange(e.currentTarget.value.trim() || null)}`. If the user pastes a URL and immediately clicks "Create suggestion" without tabbing out, the `onBlur` fires first (because submit causes the input to lose focus), so it works — but only barely, and only because React batches state updates. A keyboard-only user tabbing through fields might submit before the blur fires.

**Evidence:** Line 93 `onBlur={...}`.

**Fix:** Handle both `onChange` (live) AND `onBlur` (commit on exit), or switch to controlled input with useState mirror.

---

### [LOW] LO-07 — Route-param Route.useParams() in edit route does not validate the `id` is a UUID before rendering SuggestionForm

**File:** `src/routes/admin/suggestions/$id.edit.tsx:11`
**Category:** input validation
**Issue:** `const { id } = Route.useParams()` — the TanStack router will pass whatever string the URL contains. If an admin manually navigates to `/admin/suggestions/not-a-uuid/edit`, the SuggestionForm will issue a `polls_effective.select().eq('id', 'not-a-uuid')` which returns an empty result → the form hits the `loadError` branch. That's fine — but the error state says "Couldn't load this suggestion" rather than "Invalid suggestion ID". Minor UX polish.

**Evidence:** Line 11 no validation.

**Fix:** Add `parseParams` to the route definition:
```ts
parseParams: ({ id }) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid UUID')
  return { id }
},
```

---

### [LOW] LO-08 — `useSuggestions` error messages leak the same generic "Try refreshing" text for 4 different failure modes

**File:** `src/hooks/useSuggestions.ts:44-109`
**Category:** UX / observability
**Issue:** Polls fetch, choices fetch, cats fetch, and votes fetch all set the same error message. An operator triaging a production report can't tell which stage failed. A 1-line distinction would make support triage easier.

**Evidence:** Lines 44, 63, 88, 107 all set `'Failed to load topics. Try refreshing the page.'` (or similar).

**Fix:** Include the failing stage in the error (public UI stays the same, but `console.error` already logs the specific error object — good). Consider a dedicated error code string in setError so downstream observability can distinguish.

---

### [NIT] NI-01 — `search-admin-targets` has no `ORDER BY` on its `ilike` query

**File:** `supabase/functions/search-admin-targets/index.ts:55-59`
**Issue:** Results come back in Postgres' insertion order by default. Not a bug — users see what they see — but means the same query can return different orderings across invocations if rows were inserted in different orders. Consider `.order('discord_username', { ascending: true })`.

---

### [NIT] NI-02 — `promote-admin` pre-auth branch's retroactive flip logs-but-does-not-fail when the flip errors

**File:** `supabase/functions/promote-admin/index.ts:89-96`
**Issue:** Comment on line 95 says "Don't fail the whole request; pre-auth still succeeded." That is intentional. But the caller (admin) has no way to know the retroactive flip failed — the success toast is unambiguous. Consider returning `{ success: true, mode: 'preauth', retroactive_flip_ok: !flipError }` so the UI could warn if needed. Not worth doing for this phase; noting for the log.

---

### [NIT] NI-03 — `AdminsList` fetch is deferred via `setTimeout(..., 0)` to avoid the react-hooks/set-state-in-effect rule

**File:** `src/components/admin/AdminsList.tsx:41-53`, `src/hooks/useCategories.ts:29-36`, `src/hooks/useSearchAdminTargets.ts:18-60`
**Issue:** Three separate files use `setTimeout(..., 0)` as a workaround for a lint rule about synchronous `setState` in effect bodies. The comment acknowledges the workaround. It works, but the pattern is subtle and every maintainer will ask "why the setTimeout?". Prefer the explicit `useEffect` with an async wrapper function (the standard pattern), or — if the lint rule is too aggressive — disable it locally with a `// eslint-disable-next-line`.

---

### [NIT] NI-04 — `AdminSuggestionRow.needsResolution` computes the amber flag at render, could be memoized

**File:** `src/components/admin/AdminSuggestionRow.tsx:28-29`
**Issue:** Trivial — `const isClosed = s.status === 'closed'` and `const needsResolution = isClosed && s.resolution === null`. Running every render. Fine at Phase 4 scale. Future-proofing note only.

---

### [NIT] NI-05 — `useSearchAdminTargets` starts a timeout with `setTimeout(..., 0)` and immediately calls `setSearching(true)` inside it

**File:** `src/hooks/useSearchAdminTargets.ts:36-54`
**Issue:** The 0-ms timeout is for the ESLint rule, but it means the "searching..." state briefly flickers on if the user types fast enough. Benign.

---

## Invariant Audit

| Invariant | Status | Evidence |
|---|---|---|
| **polls_effective read path** (public reads never hit base `polls`) | **PASS** | `useSuggestions.ts:34` reads `polls_effective`; `SuggestionForm.tsx:47` reads `polls_effective`; `AdminSuggestionsTab.tsx:26` reads `polls_effective`; the only `from('polls')` in `src/` outside allowlisted `CategoriesList.tsx:112` is in test files. Invariant test at `polls-effective-invariant.test.ts:53` has the correct regex (literal `polls`, not `polls_effective`) — the regex `/from\(\s*['"]polls['"]\s*\)/` will NOT match `polls_effective` because of the closing quote. Guard is non-tautological and catches real violations. Allowlist is minimal (1 entry — `CategoriesList.tsx` for the admin count query). PASS. |
| **vote_counts is cache** (no EF uses `vote_counts.count` for security decisions) | **PASS** | Grepped all 15 EFs under `supabase/functions/` — no matches for `vote_counts.count` or any `vote_counts` security-gating usage. `delete-poll/index.ts:56-61` and `update-poll/index.ts:97-102` both use `EXISTS`-style `from('votes').select('id').eq('poll_id', ...).limit(1).maybeSingle()`. The RPC `update_poll_with_choices` at migration line 171 uses `IF EXISTS (SELECT 1 FROM public.votes WHERE poll_id = p_poll_id)`. Admin UI's `vote_counts` reads in `AdminSuggestionsTab.tsx` and `SuggestionForm.tsx` are display-only (enable/disable edit/delete buttons) — the authoritative edit-lock is re-enforced server-side. PASS. |
| **requireAdmin before write** (every admin EF except `close-expired-polls`) | **PASS** | Verified 13 EFs (`create-poll`, `update-poll`, `close-poll`, `pin-poll`, `delete-poll`, `set-resolution`, `create-category`, `rename-category`, `delete-category`, `promote-admin`, `demote-admin`, `search-admin-targets`, `get-upload-url`). In every file the sequence is: read auth header → create user client → `auth.getUser()` → create admin client → `requireAdmin(admin, user.id)` → if `!ok.ok` return 403 → THEN the body parsing and DB write. The structural test at `admin-auth-coverage.test.ts:82-92` verifies ordering via source-index search. `close-expired-polls` is the documented carve-out and uses `CLOSE_SWEEPER_SECRET` + `X-Cron-Secret` header gate (see next row). PASS. |
| **Transactional update-poll** (RPC, not chained supabase-js) | **PASS** | `update-poll/index.ts:113-121` invokes `supabaseAdmin.rpc('update_poll_with_choices', ...)`. NO direct `from('choices').delete()` or `from('choices').insert()` anywhere in the EF file — verified by grep. The RPC at migration lines 145-199 wraps UPDATE + DELETE + INSERT + RAISE guards inside a single plpgsql block so any exception triggers full rollback. `RETURNS UUID` with `RETURNING id INTO updated_id` properly handles the not-found case. Defense-in-depth vote re-check at migration line 171. PASS. |
| **Cron secret gate** (close-expired-polls requires `CLOSE_SWEEPER_SECRET` and header match, fails closed if unset) | **PASS** | `close-expired-polls/index.ts:36-45` reads `expectedSecret = Deno.env.get('CLOSE_SWEEPER_SECRET')`. If unset → `return 503 'Sweeper not configured'` BEFORE any DB write. If set but header is missing/mismatched → 401. The DB write at line 53 is only reached after both checks. Fails CLOSED on unset env var. Header check is literally `providedSecret !== expectedSecret` — constant-time comparison is NOT required here because the attack window is cron abuse by a pre-authorized service; timing attacks against a shared secret from the public internet would still require a reachable URL + ability to send headers, and supabase functions are TLS-terminated. Acceptable. PASS. |
| **Self-demote guard** (EF returns 400, UI hides button) | **PASS** | `demote-admin/index.ts:56-58` has the literal `if (target_user_id === user.id) return json({ error: 'Cannot demote yourself' }, 400, corsHeaders)` BEFORE the DB write at line 60. `AdminsList.tsx:102` hides the Demote button when `isSelf = user?.id === a.id`. Both layers enforced. Test at `demote-admin.test.ts:27-29` pins the literal text — brittle per ME-03 but functional today. PASS. |

## Cross-file trace results

### Trace 1 — update-poll call chain (HIGH #1 cross-AI resolution check)

`useUpdatePoll.ts:39` → `supabase.functions.invoke('update-poll', {body: input})` → `supabase/functions/update-poll/index.ts:23` Deno.serve handler → `requireAdmin` at line 45 (BEFORE body parse) → body validation lines 48-92 → EXISTS vote pre-check at 97-109 → `supabaseAdmin.rpc('update_poll_with_choices', ...)` at 113 → migration `update_poll_with_choices` lines 145-199: choice-count guard → vote-EXISTS guard → `UPDATE polls` → `IF updated_id IS NULL RAISE` → `DELETE FROM choices WHERE poll_id = ...` → `FOREACH ... INSERT INTO choices`. Full chain is transactional. No raw `choices.delete()` or `choices.insert()` in the EF. **HIGH #1 fully resolved.**

### Trace 2 — upload path content-type enforcement

`useUploadImage.ts:8-11` browser-side MIME check (`ALLOWED_MIME` = jpeg/png/webp) → `useUploadImage.ts:16-20` calls `get-upload-url` with `contentType: file.type` → `get-upload-url/index.ts:61-68` server-side allowlist check (same list: jpeg/png/webp) → `createSignedUploadUrl` minting → client `uploadToSignedUrl` at `useUploadImage.ts:27-30` with `contentType: file.type` → storage bucket's `allowed_mime_types` at migration line 214 = `ARRAY['image/jpeg', 'image/png', 'image/webp']`. All three layers agree. SVG is excluded at every layer. **T-04-03 mitigation holds.**

### Trace 3 — client/server validation drift check

`src/lib/validation/suggestion-form.ts:14-58` (client) vs `create-poll/index.ts:58-83` and `update-poll/index.ts:63-92` (server):

| Rule | Client | create-poll | update-poll | RPC |
|---|---|---|---|---|
| title.length 3..120 | YES (18-19) | YES (65-66) | YES (74-76) | no check |
| description.length 0..1000 | YES (22) | YES (68-69) | YES (77-79) | no check |
| choices.length 2..10 | YES (25-26) | YES (71-72) | YES (80-82) | YES (migration 113-115, 164-166) |
| choice.length 1..200 | client enforces via `c === ''` check (line 27) — server enforces via `<1 or >200` (lines 77/86) — **minor drift**: client rejects whitespace-only as empty after trim, server also trims (line 74/83) then checks `>= 1`. Same behavior. | | | |
| Duplicate choices (case-insensitive) | YES (29-32) | **NO** | **NO** | **NO** |
| closes_at > now + 60s | YES (34-37) | YES (89-92) | YES (89-92) | no check |
| image_url is valid URL | YES (39-45) | **NO** (accepts any string) | **NO** | no check |

**Drift found:** two rules (duplicate choices, URL validity) are client-only. An attacker bypassing the form (curl to EF) can create polls with duplicate choices or garbage image URLs. Duplicate choices is benign (UI shows them as-is, no unique constraint). Garbage image URL shows a broken image. NOT a security concern — flag as LOW (see ME-04 bucket for the broader validation split discussion — actually this deserves its own entry but the cross-AI review already flagged MEDIUM #4 about validation duplication drift, so noting here as a crumb rather than a new finding). No action required unless the project adds a DB check constraint.

### Trace 4 — polls_effective consumer audit

Downstream consumers of `polls_effective` that read the `status` column:
- `useSuggestions.ts:36` — filters `.eq('status', status)` where status is the argument (active/closed). Reads effective status. Correct.
- `AdminSuggestionsTab.tsx:30` — conditionally filters status; if filter='all' reads all. Correct.
- `SuggestionForm.tsx:47-51` — reads `.select('*').eq('id', pollId).single()`. Does NOT filter by status. Edit form intentionally allows loading any poll by id. Correct.
- `AdminSuggestionRow.tsx:27` — reads `s.status` from the hydrated admin suggestion (sourced from polls_effective). The `raw_status` field is carried through the `AdminSuggestion` type (line 11) but NEVER consumed anywhere in admin code — verified no consumers of `.raw_status`. **Unused type field** — not a bug, but dead type surface. Remove if desired.

No consumer treats `raw_status` as authoritative. No consumer reads from base `polls` for a status check. **Invariant holds.**

### Trace 5 — admin mutation hook → EF → RPC chain for every admin action

All nine admin mutation hooks (`useCreatePoll`, `useUpdatePoll`, `useDeletePoll`, `useClosePoll`, `usePinPoll`, `useSetResolution`, `usePromoteAdmin`, `useDemoteAdmin`, `useCategoryMutations`) invoke their EFs via `supabase.functions.invoke(<name>, { body })`. Every EF:
1. Checks `Authorization` header → 401 if missing.
2. Creates user-scoped client + calls `auth.getUser()` → 401 if auth fails.
3. Creates service-role client.
4. Calls `requireAdmin(admin, user.id)` → 403 if not admin / MFA lost / guild lost.
5. Parses and validates body.
6. Performs mutation.

The ordering (gate before write) is verified by `admin-auth-coverage.test.ts:82-92`. Full chain clean.

## Out-of-scope observations (not blocking)

- **Integration tests for critical admin flows (Phase 5 prep):** ME-03 and cross-AI MEDIUM #1 both flag that source-analysis tests check shape, not behavior. Suggest a tiny Deno/Supabase local-stack suite post-Phase 4 to cover: create-poll success, update-poll 409, demote self 400, SVG reject in get-upload-url. Non-blocking.
- **Rate limiting:** Phase 4 adds 15 EFs that accept admin-only actions. No rate limiting (Upstash Redis is budgeted for Phase 5). An admin with leaked credentials could spray `promote-admin` or `create-poll` calls at high volume. Budget-permitting, add a simple sliding-window limit on `create-poll` / `get-upload-url` next phase.
- **RPC error-code hardening (ME-01):** Switching to `ERRCODE = 'P0001'` and matching on `rpcError.code` instead of `rpcError.message` would make update-poll's 409 mapping resilient to RAISE text changes. Small refactor, good investment.
- **Shared hook helper extraction:** Nine copies of `extractMessage` across hook files (ME-04). One 15-min refactor consolidates them.
- **CategoriesList admin-only count query:** `CategoriesList.tsx:112` reads base `polls` directly. This is intentional and allowlisted in `polls-effective-invariant.test.ts:17-22`. The query uses `head: true` + `count: 'exact'` — efficient and correct. The allowlist comment correctly notes "admin-only, does NOT filter by polls.status". Preserved as-is.
- **Navbar desktop nav has no Admin link.** `Navbar.tsx:36-53` shows Topics + Archive links for signed-in users, but no "Admin" link. Admins navigate to `/admin` by typing the URL. That may be intentional (security-by-obscurity is not security, but reducing the admin surface's discoverability is a fine UX choice for a small-admin-pool project). Flag for Phase 5 or UI-review discussion.
- **`AdminSuggestion.raw_status` is dead surface.** Defined at `AdminSuggestionRow.tsx:11` but never read. Delete or document.

## Re-verification of prior cross-AI concerns (from 04-REVIEWS.md)

| Prior concern | Severity | Resolution status | Evidence |
|---|---|---|---|
| HIGH #1 `update-poll` non-transactional | HIGH | **PASS** | See Trace 1. RPC exists, EF uses it, no direct choices.delete/insert. Grepped. |
| HIGH #2 profiles SELECT RLS unverified | HIGH | **PASS** | `profiles-rls-preflight.test.ts` greps existing migration for `USING (true)`. Test is not tautological — it will fail if the policy is narrowed in a future migration. |
| HIGH #3 supabase db push blocker | HIGH | **N/A** (operational) | Out of code-review scope. Phase verification reports plan mark it manually-run. |
| HIGH #4 close-expired-polls ungated | HIGH | **PASS** | Cron-secret gate implemented at `close-expired-polls/index.ts:36-45`. Fails closed on unset env. |
| MEDIUM #1 04-04 scope / mock-heavy tests | MEDIUM | **PARTIAL** | See ME-03 — still shape-only. Not blocking but unfixed. |
| MEDIUM #2 polls_effective consistency | MEDIUM | **PASS** | See Trace 4 + invariant audit row 1. Invariant test actively guards. |
| MEDIUM #3 validation duplication | MEDIUM | **PARTIAL** | See Trace 3 — drift identified (duplicate choices, URL validity). Not a security issue. Documented. |
| MEDIUM #4 vote_counts not security | MEDIUM | **PASS** | See invariant audit row 2. No EF uses vote_counts for gating. |
| MEDIUM #5 missing error states | MEDIUM | **PASS** | AdminsList, CategoriesList, AdminSuggestionsTab, SuggestionForm all have explicit `<Alert variant="destructive">` + Retry branches. Tests cover them. |
| LOW #1 Category delete affected-count | LOW | **PASS** | `CategoriesList.tsx:108-140` queries real count via `from('polls').select('id', { count: 'exact', head: true })` before showing dialog. `useCategoryMutations.ts:74-80` ships real count into the success toast. |
| LOW #2 Plans too-specific | LOW | **N/A** | Planning quality, not code quality. |

All eight resolvable prior concerns (4 HIGH, 3 MEDIUM, 1 LOW) verified as holding. Two MEDIUMs are partial (test quality, validation drift) — already noted in this review.

## Go/No-Go recommendation

**GO — merge approved.**

- Zero CRITICAL findings.
- One HIGH (HI-01) — the `.in('poll_id', pollIds)` fix is a 1-line change that should land before merge but is not a merge blocker on its own; the code is correct for Phase 4 scale and the fix is trivial. Strongly recommend applying it now so Phase 5 doesn't inherit the latent issue.
- All six invariants hold.
- All four prior HIGH concerns resolved.
- Medium findings are defense-in-depth improvements and test-quality debt, not functional defects.
- No security vulnerabilities. No data-integrity regressions beyond what's already caught server-side.
- Merge-ready pending: (1) the HIGH fix or an explicit defer note, (2) optional ME-01 error-code hardening, (3) ME-06 catch-block consistency in promote/demote hooks.

Top 3 most-impactful findings (for planner consumption):
1. **HI-01** — `useSuggestions` user votes query is unbounded; add `.in('poll_id', pollIds)` (1-line fix, high leverage).
2. **ME-01** — update-poll error-mapping is regex-on-message; switch RPC `RAISE` to `USING ERRCODE = 'P0001'` and key off `rpcError.code`.
3. **ME-06** — `usePromoteAdmin` / `useDemoteAdmin` missing catch blocks; add to prevent unhandled promise rejection on transport failures.

---

_Reviewed: 2026-04-11_
_Reviewer: Claude Opus 4.6 (gsd-code-reviewer)_
_Depth: deep (cross-file trace + invariant audit)_
