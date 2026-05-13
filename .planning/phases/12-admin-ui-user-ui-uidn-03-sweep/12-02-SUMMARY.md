---
phase: 12-admin-ui-user-ui-uidn-03-sweep
plan: 02
subsystem: ui
tags: [vis-06, uidn-03, suggestion-form, shadcn, tanstack-router, checkbox]

# Dependency graph
requires:
  - phase: 11-schema-rls-ef-foundations
    provides: polls.results_hidden column; create-poll EF accepts optional results_hidden body field (D-08); polls_effective view projects results_hidden
  - phase: 12-admin-ui-user-ui-uidn-03-sweep/00
    provides: shadcn Checkbox primitive (src/components/ui/checkbox.tsx); regenerated database.types.ts including polls.results_hidden
provides:
  - SuggestionFormInput.results_hidden optional boolean — flows from form into create-poll EF body without explicit field marshalling
  - validateSuggestionForm preserves results_hidden on sanitized return via strict-true coercion (collapses undefined/false/'indeterminate' to false)
  - SuggestionForm.tsx VIS-06 visibility section: editable Checkbox in create mode (data-testid="visibility-checkbox"); read-only Eye/EyeOff status row in edit mode (data-testid="visibility-status") pointing admins to the Plan 03 admin-list Switch
  - UIDN-03 D-14 closure: SuggestionForm.tsx lines 140 + 163 native <button> back-links replaced with TanStack <Link to="/admin"> — restores middle-click / cmd-click / right-click → "Open in new tab" semantics
  - Test infrastructure: global ResizeObserver polyfill in src/test/setup.ts so radix-ui-backed shadcn primitives (Checkbox, Switch, etc.) mount cleanly under jsdom
affects: [12-03 VIS-07 Switch consumer (shares results_hidden state), 12-04 VIS-08 voter-side hidden Alert, 12-06 TEST-13 E2E (targets data-testid="visibility-checkbox" in create flow)]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — Checkbox was vendored in Wave 1 (Plan 00); Link is in the existing @tanstack/react-router package
  patterns:
    - "Mode-branched JSX for fields whose backing EF does not exist in both directions: editable control in create mode, read-only status display in edit mode — avoids the silent no-op anti-pattern"
    - "Validator strict-true coercion at the sanitization boundary preserves optional boolean fields on explicit-return validators (otherwise the field is silently dropped from the validated value)"
    - "jsdom + radix-ui: global ResizeObserver polyfill in test setup is mandatory for any component test that mounts a radix-ui primitive using use-size internally"

key-files:
  created: []
  modified:
    - src/lib/validation/suggestion-form.ts  # +results_hidden field on type and sanitized return
    - src/hooks/useCreatePoll.ts             # +WHY-only comment documenting the results_hidden pass-through contract
    - src/components/suggestions/form/SuggestionForm.tsx  # +Visibility section (mode-branched), two <Link> back-link replacements, results_hidden state + loadPoll pre-population + submit forwarding
    - src/__tests__/admin/suggestion-form-validation.test.ts  # +3 validator cases for results_hidden (true / omitted / explicit-false)
    - src/__tests__/admin/suggestion-form.test.tsx  # Link added to @tanstack/react-router vi.mock so component-tests find the export
    - src/test/setup.ts                      # global ResizeObserver polyfill

key-decisions:
  - "Validator strict-true coercion (`input.results_hidden === true`) chosen over `Boolean()` or `??`: collapses undefined, false, and Radix Checkbox's `'indeterminate'` state into a deterministic boolean so the EF body always carries an explicit value, matching the create-poll EF's `boolean | undefined` contract (Phase 11 D-08)."
  - "Edit-mode renders a READ-ONLY status row instead of an editable Checkbox (cross-AI review HIGH fix locked into the plan). The update-poll EF does NOT accept `results_hidden`; an editable checkbox in edit mode would let admins toggle a UI control and see no DB change. The read-only Eye/EyeOff row plus `'Toggle from the admin list to change visibility.'` helper text point admins to the Plan 03 admin-list Switch (toggle-results-visibility EF)."
  - "Submit handler unconditionally forwards `results_hidden: resultsHidden` into the input. The validator's strict-true coercion already collapses all falsy inputs to `false`; update-poll EF naturally ignores the field (verified by reading supabase/functions/update-poll/index.ts — zero `results_hidden` references). Unconditional inclusion keeps the call-site simple; EF behavior diverges naturally."
  - "Search-param disposition (D-14, Claude's discretion): `<Link to=\"/admin\">` does NOT carry `search={{ tab: 'suggestions' }}`. Mirrors prior `navigate({ to: '/admin' })` behavior — zero-delta navigation per UIDN-03 mandate. Deferred to follow-up if admins report missing-context behavior (per CONTEXT.md `<deferred>`)."
  - "Validator unit tests appended to existing `src/__tests__/admin/suggestion-form-validation.test.ts` (the plan-noted analog) rather than creating a parallel `src/__tests__/lib/validation/` tree — keeps test discovery consistent with current project layout. Plan Step 5 explicitly allowed this (\"or the existing analog if differently named\")."

patterns-established:
  - "Per-commit HEAD/cwd-drift safety: each commit re-asserts `worktree-agent-*` branch namespace before staging (#2924), continuing Wave 1's pattern"
  - "Wave 2 plans assume Wave 1 type regen: SuggestionForm.tsx reads `poll.results_hidden` directly off the `polls_effective` SELECT without an `unknown`-cast escape — types now make this safe"
  - "Mode-branched control rendering for fields whose write-path EF is asymmetric (create accepts, update does not): editable in one mode, read-only signpost in the other"

requirements-completed: [VIS-06, UIDN-03]

# Metrics
duration: ~12 min
completed: 2026-05-12
---

# Phase 12 Plan 02: VIS-06 Checkbox + UIDN-03 D-14 Back-Link Sweep Summary

**Wired the admin-side "Hide results from voters" Checkbox into `SuggestionForm` create flow with EF pass-through (via validator strict-true coercion), added a read-only edit-mode status row pointing admins to the Plan 03 admin-list Switch, and replaced the two `SuggestionForm.tsx` native `<button>` back-link sites with declarative TanStack `<Link>` (UIDN-03 D-14 — 2 of 4 sweep sites closed).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-12T14:23Z (approx)
- **Completed:** 2026-05-12T14:29Z
- **Tasks:** 2 (both autonomous, no checkpoints)
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments

- **VIS-06 type + validator wiring (Task 1).** `SuggestionFormInput` gains optional `results_hidden?: boolean`; `validateSuggestionForm` includes the field on its explicit sanitized return via strict-true coercion (`input.results_hidden === true`). The coercion handles all three problematic inputs in one line: `undefined` (no UI selection), `false` (explicit unchecked), and `'indeterminate'` (Radix Checkbox tri-state). `useCreatePoll` gets a WHY-only comment documenting the contract — no code change needed there because the input flows through verbatim. Three new validator unit tests (true / omitted / explicit-false) pin the contract.
- **VIS-06 form section (Task 2 — create mode).** A new `<div className="space-y-2">` section slots between `CategoryPicker` and the sticky submit bar. Create mode renders shadcn `Checkbox` with `id="results-hidden"`, REQUIREMENTS-verbatim label "Hide results from voters", helper copy "Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list.", and `data-testid="visibility-checkbox"` (Plan 06 TEST-13 hook). Defaults unchecked (backwards-compat with VIS-01).
- **VIS-06 edit-mode read-only row (Task 2 — cross-AI review HIGH fix).** Edit mode renders a status indicator (`Eye` / `EyeOff` lucide icon + "Results currently hidden" / "Results currently visible") plus helper text "Toggle from the admin list to change visibility." Carries `data-testid="visibility-status"` so test code can distinguish modes. Pre-populates from the loaded `polls_effective.results_hidden` value.
- **UIDN-03 D-14 closure (Task 2).** Two `<button type="button" onClick={() => navigate({ to: '/admin' })}>` sites at the loadError branch (line 140) and the main render path (line 163) replaced with TanStack `<Link to="/admin">`. ClassName preserved verbatim — zero visual delta. The `useNavigate` import stays because the submit-success handlers and Cancel button still need imperative navigation.
- **Test infra Rule 3 fix.** Adding the shadcn `Checkbox` to a component-test render path surfaced a pre-existing latent issue: jsdom does not implement `ResizeObserver`, and radix-ui's `use-size` hook reaches for it on layout-effect mount. Polyfilled globally in `src/test/setup.ts` — unblocks all future Wave 2 plans that render Switch, Select, Popover, etc. under jsdom.
- **All gates green:** `npm run lint` (0 errors), `npx tsc -b` (exit 0), `npm run test` (**393 / 393 passing**, up from 390 — three new validator tests). `polls-effective-invariant.test.ts` still passes (no new direct `from('polls')` reads).

## Task Commits

Each task was committed atomically on `worktree-agent-aeea79257114b0921`:

1. **Task 12-02-01: Extend SuggestionFormInput + useCreatePoll for results_hidden pass-through** — `68804c3` (feat)
2. **Task 12-02-02: Add VIS-06 Checkbox row to SuggestionForm + two UIDN-03 D-14 back-link replacements** — `59e2b6d` (feat)

## Files Created/Modified

- `src/lib/validation/suggestion-form.ts` — `SuggestionFormInput.results_hidden?: boolean` field; `validateSuggestionForm` adds the field to its sanitized return value via strict-true coercion (a single `const resultsHidden = input.results_hidden === true` above the success-return block)
- `src/hooks/useCreatePoll.ts` — single WHY-only comment above the `supabase.functions.invoke('create-poll', { body: input })` call documenting the pass-through contract (no code change)
- `src/components/suggestions/form/SuggestionForm.tsx` — added imports (`Link`, `Checkbox`, `Eye`, `EyeOff`); added `resultsHidden` state and edit-mode pre-population from `polls_effective.results_hidden`; mode-branched Visibility section between CategoryPicker and the submit bar; two `<button>` back-link sites replaced with `<Link>`; submit handler unconditionally forwards `results_hidden`
- `src/__tests__/admin/suggestion-form-validation.test.ts` — appended three new test cases covering the `results_hidden` validator contract (true preserved / omitted coerced to false / explicit false coerced to false)
- `src/__tests__/admin/suggestion-form.test.tsx` — expanded `vi.mock('@tanstack/react-router', ...)` to include a `Link` mock matching the established `Navbar.test.tsx` pattern (anchor with `data-to` for assertion); without this, the component-import would fail because the mock previously only exposed `useNavigate`
- `src/test/setup.ts` — global `ResizeObserver` polyfill so radix-ui-backed shadcn primitives mount cleanly under jsdom

## Decisions Made

- **Validator coercion at the source-of-truth layer (not the call site).** `validateSuggestionForm` becomes the single funnel through which the field passes from form-state into the EF body. The strict-true coercion (`input.results_hidden === true`) is one line above the explicit-return block — it collapses `undefined` / `false` / `'indeterminate'` into a deterministic boolean. Doing this at the call site instead would require every future caller (e.g., a hypothetical bulk-create form) to remember the coercion; doing it here makes the contract uniform.
- **Read-only edit-mode row over editable-but-disabled Checkbox.** The cross-AI review HIGH issue was: an editable checkbox in edit mode that calls a no-op EF feels broken to admins. A disabled Checkbox would leave the state visible but invite confusion ("why is this disabled? can I enable it?"). The Eye/EyeOff status row + redirect copy ("Toggle from the admin list to change visibility.") leaves no doubt: this control is informational, the toggle lives elsewhere. Plan 03 will deliver that "elsewhere" (the admin-list Switch).
- **Test analog appended, not parallelized.** Plan Step 5 said "Find or create `src/__tests__/lib/validation/suggestion-form.test.ts` (or the existing analog — discover via `ls`)". The existing analog at `src/__tests__/admin/suggestion-form-validation.test.ts` already houses 16 validator tests for the same exported function; appending three more there keeps the validator test surface in one place. Creating a parallel `src/__tests__/lib/validation/` tree would have split the test surface and made future regressions ambiguous.
- **Search-param disposition `to="/admin"` without `search`.** D-14 left this to Claude's discretion. The current `navigate({ to: '/admin' })` does not pass `search={{ tab: 'suggestions' }}`, so adding it on the `<Link>` would be a behavioral change beyond the UIDN-03 "zero-delta" mandate. The admin index route's default-tab fallback already routes correctly. If admins later report tab-context loss, it's a follow-up — explicitly noted in CONTEXT.md `<deferred>`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Global ResizeObserver polyfill added to src/test/setup.ts**
- **Found during:** Task 2 (verification gate `npm run test -- --run src/__tests__/admin/polls-effective-invariant`)
- **Issue:** First run of the component test for `SuggestionForm` (which now mounts `<Checkbox>` from shadcn / radix-ui) failed with `ReferenceError: ResizeObserver is not defined`. The radix-ui `use-size` hook (used internally by Checkbox + several other primitives) requires `ResizeObserver`, which jsdom does not implement. This blocks every Wave 2 plan that mounts a vendored shadcn primitive in a component test (Plan 03 Switch, future Select / Popover / Dialog adds).
- **Fix:** Added a minimal `ResizeObserverPolyfill` class with no-op `observe`/`unobserve`/`disconnect` methods to the global `src/test/setup.ts` (the existing `setupFiles` entry referenced from `vite.config.ts`). Guarded with a `typeof globalThis.ResizeObserver === 'undefined'` check so real browser tests are untouched.
- **Files modified:** src/test/setup.ts
- **Verification:** `npm run test` — 393/393 pass (zero regressions on the other 40 test files); `npm run test -- --run src/__tests__/admin/suggestion-form.test.tsx` — 6/6 pass
- **Committed in:** 59e2b6d (Task 2 commit)

**2. [Rule 3 - Blocking] Link added to @tanstack/react-router mock in suggestion-form.test.tsx**
- **Found during:** Task 2 (after the back-link `<button>` → `<Link>` swap)
- **Issue:** `src/__tests__/admin/suggestion-form.test.tsx` previously mocked `@tanstack/react-router` with only `useNavigate`. After the component started importing `Link`, the test render path would fail to find the export (Vite mock replaces the module entirely).
- **Fix:** Expanded the mock to include `Link: ({ children, to, ...props }) => <a href={to} data-to={to} {...props}>{children}</a>` — matches the established mock pattern in `src/__tests__/layout/Navbar.test.tsx` exactly.
- **Files modified:** src/__tests__/admin/suggestion-form.test.tsx
- **Verification:** `npm run test -- --run src/__tests__/admin/suggestion-form.test.tsx` — 6/6 pass
- **Committed in:** 59e2b6d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues directly caused by this plan's changes)
**Impact on plan:** Both fixes were tightly scoped to the new wiring; neither expanded scope nor altered planned files beyond the test-setup polyfill (a one-liner). The ResizeObserver polyfill is a Wave 2 enabler — Plan 03's Switch tests would have hit the same wall.

## Issues Encountered
- None beyond the two auto-fixed deviations above. Both surfaced naturally during verification and were resolved inline.

## User Setup Required

None — no external service configuration changes. All changes are application-code and test-setup updates.

## Self-Check: PASSED

- File `src/lib/validation/suggestion-form.ts` modified: FOUND (`results_hidden?: boolean` on type, `results_hidden: resultsHidden` on return)
- File `src/hooks/useCreatePoll.ts` modified: FOUND (WHY comment present)
- File `src/components/suggestions/form/SuggestionForm.tsx` modified: FOUND (`Link` imported, `Checkbox` imported, two `<Link to="/admin">` sites, `data-testid="visibility-checkbox"` + `data-testid="visibility-status"` both present, `'Hide results from voters'` literal present)
- File `src/__tests__/admin/suggestion-form-validation.test.ts` modified: FOUND (three new test cases)
- File `src/__tests__/admin/suggestion-form.test.tsx` modified: FOUND (`Link` in router mock)
- File `src/test/setup.ts` modified: FOUND (ResizeObserver polyfill)
- Commit `68804c3` exists: FOUND on `worktree-agent-aeea79257114b0921`
- Commit `59e2b6d` exists: FOUND on `worktree-agent-aeea79257114b0921`
- `npm run lint`: 0 errors
- `npx tsc -b`: exit 0
- `npm run test`: 393 / 393 passing
- `npm run test -- --run src/__tests__/admin/polls-effective-invariant`: 2 / 2 passing (no new direct `from('polls')` reads)

## Next Phase Readiness
- **VIS-06 create-side wiring complete and ready for Plan 06 TEST-13 happy-path E2E:** the `data-testid="visibility-checkbox"` hook lives in the create-mode branch where TEST-13 will exercise it.
- **VIS-07 (Plan 03) can proceed in parallel within Wave 2:** the Switch consumer reads from the same `polls_effective.results_hidden` column that Plan 02 pre-populates in edit mode; no file-ownership conflict (Plan 02 owns SuggestionForm.tsx, Plan 03 owns AdminSuggestionRow.tsx).
- **UIDN-03 sweep status after this plan:** 3 of 4 sites closed (Plan 01 closed `SearchBar.tsx:22`; Plan 02 closed `SuggestionForm.tsx:140` + `:163`). Remaining: `ImageInput.tsx:108` (Plan 05 DropZone extract).

---
*Phase: 12-admin-ui-user-ui-uidn-03-sweep*
*Plan: 02*
*Completed: 2026-05-12*
