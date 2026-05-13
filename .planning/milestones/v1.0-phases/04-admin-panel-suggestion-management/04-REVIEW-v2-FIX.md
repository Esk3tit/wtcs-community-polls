---
phase: 04
date: 2026-04-18
source_review: 04-REVIEW-v2.md
baseline_commit: 9dce1f4
findings_total: 8
findings_fixed: 8
findings_skipped: 0
status: all_fixed
---

# Phase 4 Pre-UAT Review-Fix Report

Applies fixes for every finding in `04-REVIEW-v2.md` (1 MEDIUM + 4 LOW + 3 NIT = 8 total). All fixes committed atomically on `gsd/phase-04-admin-panel-suggestion-management`. Tests at 330/330 and `npm run build` clean before and after.

## Summary

- MEDIUM: 1/1 fixed
- LOW:    4/4 fixed
- NIT:    3/3 fixed

## Applied fixes

| ID         | Sev | File:line                                                    | Commit    | Tests      | Build |
|------------|-----|--------------------------------------------------------------|-----------|------------|-------|
| ME-v2-01   | MED | `supabase/functions/close-poll/index.ts:64-80`               | `b2b76f3` | 330 -> 330 | clean |
| LO-v2-01   | LOW | `supabase/functions/rename-category/index.ts:62-68`          | `9406187` | 330 -> 330 | clean |
| LO-v2-02   | LOW | `supabase/functions/{create,update}-poll/index.ts`           | `21a0a39` | 330 -> 330 | clean |
| LO-v2-03   | LOW | `src/components/suggestions/form/TimerPicker.tsx:56-68`      | `05fd038` | 330 -> 330 | clean |
| LO-v2-04   | LOW | `src/components/suggestions/form/SuggestionForm.tsx:69-83`   | `4de2bb6` | 330 -> 330 | clean |
| NIT-v2-01  | NIT | `src/components/admin/AdminSuggestionRow.tsx:6-16`           | `dbb2e1c` | 330 -> 330 | clean |
| NIT-v2-02  | NIT | `src/hooks/useSuggestions.ts:42, 63, 87, 107`                | `1f06c93` | 330 -> 330 | clean |
| NIT-v2-03  | NIT | `src/lib/deferSetState.ts` (new) + 3 callers                 | `a7b5f96` | 330 -> 330 | clean |

Commit range: `9dce1f4..a7b5f96` (8 fix commits, one per finding).

## Fix details

### ME-v2-01 — close-poll status guard (`b2b76f3`)

Added `.eq('status', 'active')` to the `close-poll` UPDATE chain. Double-close or close on a lazy-closed poll (`closes_at<now` but `raw_status='active'`) no longer overwrites `closed_at` or `resolution`. When zero rows match, PGRST116 now returns a collapsed 404 `"Poll not found or already closed"` per the review's recommendation (avoiding an extra pre-query to distinguish 404 from 409). Preserves the first closure's audit trail.

### LO-v2-01 — rename-category empty-slug guard (`9406187`)

Added `if (!slug) return 400` immediately after the slugification step, mirroring the existing guard in `create-category`. A rename to `"!!!"` now returns a clean 400 (`"Category name must contain at least one alphanumeric character"`) instead of a generic 500 from the downstream NOT NULL violation.

### LO-v2-02 — server-side image_url URL validation (`21a0a39`)

Added `try { new URL(image_url) } catch { return 400 }` to BOTH `create-poll` and `update-poll`. The EFs now enforce the same URL-wellformedness check as `validateSuggestionForm`, closing the validation-drift gap where a curl request bypassing the form could persist arbitrary non-URL strings that render as a broken `<img src>` on the public page.

### LO-v2-03 — TimerPicker inferMode logging (`05fd038`)

Added `console.warn('TimerPicker.inferMode failed to parse iso:', iso, e)` in the catch branch. A corrupt `closes_at` ISO no longer silently defaults to the 7d preset — devtools surfaces the parse failure for debugging.

### LO-v2-04 — SuggestionForm past closes_at clamp (`4de2bb6`)

Guarded the `closes_at` hydration in edit mode: if the stored value is missing, unparseable, or `<= now()+60s`, fall back to `now()+7d`. Mirrors the server-side "at least 1 minute in the future" guard so users reaching `/admin/suggestions/:id/edit` on a lazy-closed no-vote poll no longer see an unexplained validation error on submit.

### NIT-v2-01 — drop raw_status from AdminSuggestion (`dbb2e1c`)

Removed the `raw_status: string` field from the `AdminSuggestion` type in `AdminSuggestionRow.tsx`. The field was dead type surface — no consumers in `src/`. Admin rows hydrate from `polls_effective`, where the effective `status` column is authoritative. Test fixtures that pass `raw_status: 'active'` as extra runtime data remain valid because `AdminSuggestionsTab` casts via `(data ?? []) as unknown as AdminSuggestion[]`.

### NIT-v2-02 — useSuggestions stage suffixes (`1f06c93`)

Added `[useSuggestions:polls|choices|cats|votes]` prefixes to the four `console.error` calls in the fetch pipeline. Operators reading bug reports can now identify which stage failed without churning the user-visible copy across four sites (per the review's endorsed minimal approach). User-facing text unchanged.

### NIT-v2-03 — deferSetState helper (`a7b5f96`)

Created `src/lib/deferSetState.ts` exporting `deferSetState(fn) -> { cancel, isCancelled }`. Replaces the `setTimeout(..., 0)` + `cancelled` flag pattern in three files:

- `src/hooks/useCategories.ts`
- `src/hooks/useSearchAdminTargets.ts`
- `src/components/admin/AdminsList.tsx`

Semantics unchanged (still macrotask deferral) but the intent ("defer effect-body setState to satisfy react-hooks/set-state-in-effect") is now named and documented in one place. Eliminates the "why setTimeout 0?" question for future maintainers.

## Test/build results

- Tests before: 330 / 330 passing
- Tests after:  330 / 330 passing (no regressions)
- Build before: clean
- Build after:  clean (`vite build` 196-218 ms; bundle sizes unchanged within rounding)
- Lint: pre-commit hooks (`eslint --max-warnings 0 --no-warn-ignored`, `tsc -b --noEmit`) passed on every commit

## Deferred

None. All 8 findings fixed.

## UAT go/no-go

**GO for UAT.** Source review explicitly classified all 8 findings as "last-mile polish, not UAT blockers" and reported 0 Critical / 0 High. Applying them pre-UAT adds defense in depth:

- Audit trail protected against double-close (ME-v2-01).
- Server-side validation now matches client for category names and image URLs (LO-v2-01, LO-v2-02).
- Edit-mode edge case on lazy-closed polls surfaces a sensible default instead of an unexplained error (LO-v2-04).
- Dev-facing debuggability improved (LO-v2-03, NIT-v2-02).
- Code-hygiene wins: dead type removed, `setTimeout(0)` pattern consolidated (NIT-v2-01, NIT-v2-03).

All 8 invariants from the review still hold; no functional behavior changed beyond the documented fixes.

---

_Fixed: 2026-04-18_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
