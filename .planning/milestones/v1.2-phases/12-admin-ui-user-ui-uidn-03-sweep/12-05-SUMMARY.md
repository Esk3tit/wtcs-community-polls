---
phase: 12-admin-ui-user-ui-uidn-03-sweep
plan: 05
subsystem: ui
tags: [uidn-03, dropzone, shadcn, a11y, suggestions-form, image-upload]

# Dependency graph
requires:
  - phase: 12-admin-ui-user-ui-uidn-03-sweep
    plan: "00"
    provides: shadcn primitives baseline; project conventions canonicalized (Button variants outline/sm; cn helper)
provides:
  - DropZone component (src/components/suggestions/form/DropZone.tsx) — pure presentational + event-forwarding drag region with separate keyboard-Browse Button entry point
  - ImageInput.tsx (src/components/suggestions/form/ImageInput.tsx) — consumes DropZone; dual-role native button removed; UIDN-03 footnote [c] closed for this site
affects:
  - 12-06 Phase 12 closure plan (UIDN-03 four-site sweep tally: Plans 01/02/05 collectively closed the locked sites; Plan 05 ships the last)

# Tech tracking
tech-stack:
  added: []  # No new dependencies — DropZone consumes the existing shadcn Button + lucide-react icons
  patterns:
    - "Drag-region vs click-target separation: outer <div role='region'> owns drag handlers + visual state; inner shadcn <Button variant='outline' size='sm'> owns keyboard entry + click activation"
    - "State ownership stays with the parent: ImageInput owns uploading/dragOver/dropError + validateAndAccept; DropZone is purely presentational + event-forwarding"
    - "Error <Alert> rendered by ImageInput (kept inside aria-live='polite' role='status' wrapper) — DropZone does not know about the live-region pattern"

key-files:
  created:
    - src/components/suggestions/form/DropZone.tsx
    - .planning/phases/12-admin-ui-user-ui-uidn-03-sweep/12-05-SUMMARY.md
  modified:
    - src/components/suggestions/form/ImageInput.tsx
    - src/__tests__/admin/image-input.test.tsx

key-decisions:
  - "Inner Browse Button uses `variant='outline' size='sm'` per D-13 verbatim — matches shadcn defaults already in the v1.0 button.tsx (h-8 rounded-md px-3); no class override needed"
  - "Test selectors updated to reflect post-refactor ARIA contract — region selected by `getByRole('region', { name: /image upload/i })` for drop events; Browse Button selected by `getByRole('button', { name: /browse files/i })` for click semantics. Added an explicit anti-pattern guard that asserts the region is NOT also a button (regression net for any future re-merge of the dual roles)"
  - "Drag handlers short-circuit `onDragStateChange` on disabled/uploading per plan §4 — prevents the locked form from visually flashing drag-over while still calling preventDefault/stopPropagation so the browser does not open the file directly"
  - "dragOver ring is suppressed during uploading state (`dragOver && !uploading && 'ring-2 ring-ring'`) — defensive belt-and-suspenders against a stale dragOver flag bleeding into the uploading visual; matches Phase 4 §9 contract that uploading state is bg-muted/30 with no ring"

requirements-completed: []  # UIDN-03 is enabled by Plans 01 + 02 + 05 collectively; the requirements-completed check-off lands in Plan 06 closure (after all four sweep sites + TEST-13 verification)

# Metrics
duration: ~3 min
completed: 2026-05-12
---

# Phase 12 Plan 05: UIDN-03 D-13 DropZone Extraction Summary

**Extracted `<DropZone>` from `ImageInput.tsx` to separate the drag-target (outer `<div role="region">`) from the keyboard-Browse trigger (inner shadcn `<Button variant="outline" size="sm">`). Closes UIDN-03 audit footnote [c] dual-role anti-pattern for the largest of the four UIDN-03 sweep sites.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-12T21:23:31Z
- **Completed:** 2026-05-12T~21:26Z
- **Tasks:** 2 (both autonomous, no checkpoints)
- **Files created:** 1 (DropZone.tsx)
- **Files modified:** 2 (ImageInput.tsx, image-input.test.tsx)
- **Net line delta:** +39 / −97 in ImageInput.tsx + tests (drag-handler boilerplate moved to DropZone with cleaner separation)

## Accomplishments

- **`src/components/suggestions/form/DropZone.tsx` (NEW, 93 lines).**
  - Outer `<div role="region" aria-label="Image upload">` owns the four drag handlers (`onDragEnter`/`Over`/`Leave`/`Drop`) and the visual state (dashed border + bg-muted/30 idle, bg-muted/60 + ring-2 ring-ring on drag-over, opacity-60 cursor-not-allowed when disabled). All four handlers call `e.preventDefault()` + `e.stopPropagation()` to suppress browser-default file-open-in-tab.
  - Inner `<Button variant="outline" size="sm" aria-label="Browse files">` is the keyboard-activatable Browse trigger. Tab focuses the Button; Enter/Space activates it (native Button semantics). When `uploading` is true, the Button is replaced by `<Loader2 className="animate-spin">` + "Uploading…" inline text.
  - Idle content: `<ImagePlus className="h-8 w-8 text-muted-foreground" aria-hidden>` + `"Drop an image here"` headline + `"JPG, PNG, or WebP · max 2 MB"` helper + Browse Button. Headline shortened from the old combined `"Drop an image here, or click to browse"` because the Browse Button now visually carries the click affordance.
  - Pure presentational + event-forwarding: props `{ disabled?, uploading, dragOver, onDrop, onBrowseClick, onDragStateChange }`. No state. No knowledge of the validator, the upload path, or the error message — those stay in `ImageInput`.
  - Single WHY comment at top: `UIDN-03 D-13: separates drag-region (outer div with role="region") from the keyboard-Browse entry (inner shadcn Button). Closes the dual-role accessibility footnote [c] in the v1.1 audit.` No archaeology, no plan-ID rot.

- **`src/components/suggestions/form/ImageInput.tsx` (MODIFIED).**
  - The 56-line dual-role `<button onClick onDragEnter onDragOver onDragLeave onDrop className=cn(...)>` block (old lines 108-161) is replaced by a 7-line `<DropZone>` render. State ownership (`uploading`, `dragOver`, `dropError`, `fileRef`) and the `validateAndAccept` validator stay in `ImageInput` unchanged.
  - The redundant outer `<div role="region" aria-label="Image upload">` wrapper is removed — `DropZone`'s outer div IS the region (no double-region duplication). A plain `<div className="space-y-2">` remains as a layout shell for DropZone + the error Alert.
  - The hidden `<input ref={fileRef} type="file" ... className="hidden">` stays sibling to DropZone (preserves the existing file-picker path).
  - The `dropError <Alert>` block stays inside its `<div aria-live="polite" role="status">` wrapper below DropZone (preserves screen-reader live-region behavior).
  - Unused imports removed (`ImagePlus`, `Loader2`, `cn`) — they migrated to DropZone.
  - WHY comment updated from the old misleading `LR-07: dropzone. Whole region is a button so keyboard Enter/Space opens the file picker; drag-over adds a ring via tokens.` (which was the v1.0 anti-pattern statement) to `UIDN-03 D-13: dropzone region is a region, not a button; inner Browse Button (in DropZone) is the keyboard entry point.`
  - The `LR-07: validate a dropped file inline...` comment on `validateAndAccept` is preserved — it describes validator behavior, not the dropzone refactor, and remains correct.
  - URL tab JSX is untouched (regression-safe).
  - The `value`-truthy thumbnail branch is untouched (regression-safe).

- **`src/__tests__/admin/image-input.test.tsx` (MODIFIED — 8/8 tests passing).**
  - All eight tests in the existing suite previously selected the dropzone via `getByRole('button', { name: /drop an image here, or click to browse/i })` — i.e., they encoded the dual-role anti-pattern in selectors. Updated to reflect the post-refactor ARIA contract:
    - Region semantics: `getByRole('region', { name: /image upload/i })` for drop events
    - Click-to-browse: `getByRole('button', { name: /browse files/i })` for click + keyboard semantics
  - **New anti-pattern guard added** in the first test: `expect(screen.queryByRole('button', { name: /image upload/i })).toBeNull()` — explicitly asserts the region is NOT also a button. If any future change accidentally re-merges the drag region into a button role, this test fires.
  - Drop events still fire via `fireEvent.drop(region, { dataTransfer })` — React's synthetic event system propagates onDrop on whatever element the handler is bound to; switching from button to div changes nothing functionally for the event.
  - Browse Button regression test now activates via `user.click(getByRole('button', { name: /browse files/i }))` and asserts the hidden file input's `.click()` is called.

## Task Commits

Each task committed atomically on `worktree-agent-a410815e513f1c58b`:

1. **Task 12-05-01: Create DropZone.tsx component** — `ca6abac` (feat) — 1 file, +93 lines
2. **Task 12-05-02: Consume DropZone in ImageInput; remove dual-role native button** — `b1553c4` (feat) — 2 files, +39 / −97

## Files Created/Modified

- `src/components/suggestions/form/DropZone.tsx` (created) — 93 lines; named export `DropZone`; props contract matches plan `<interfaces>` block exactly
- `src/components/suggestions/form/ImageInput.tsx` (modified) — −58 net lines; dual-role button removed; DropZone consumed; unused imports trimmed; WHY comment canonicalized
- `src/__tests__/admin/image-input.test.tsx` (modified) — 8/8 tests passing; selectors retargeted; new anti-pattern guard added

## Decisions Made

- **Test selectors retargeted as part of Task 2 (Rule 3 auto-fix).** The plan's Task 2 verify command includes `npm run test`, and the eight existing image-input.test.tsx assertions selected the dropzone via the dual-role button's accessible name (`getByRole('button', { name: /drop an image here, or click to browse/i })`). Updating the selectors to match the new ARIA contract is a Rule 3 blocking-issue fix — without it, the plan's verify gate fails. The new selectors are stricter than the old ones (they encode the exact role-separation the refactor enforces), and the new anti-pattern guard is a regression net against future re-merges. Documented as a deviation below.
- **Plan's "if the wrapper is referenced by any test selector — keep an unstyled <div> wrapper" branch NOT taken.** The plan offered an escape hatch for keeping a redundant outer `<div role="region" aria-label="Image upload">` wrapper in ImageInput if tests selected by it. Inspection showed the existing tests selected by the button's name, not the region wrapper. So the wrapper is fully removed — the cleaner outcome the plan preferred. A plain `<div className="space-y-2">` remains as a layout shell (no role, no aria-label).
- **dragOver ring suppressed during uploading (defensive belt-and-suspenders).** Plan §4 specifies uploading state is `bg-muted/30` (no ring). Today's code path always resets `dragOver` to `false` on drop, so the ring would not normally bleed into uploading. But conditional was added (`dragOver && !uploading && 'ring-2 ring-ring'`) to defend against any future code path that sets `dragOver=true` without immediately clearing it before `uploading=true` fires. Zero behavior change in the happy path; tighter visual contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing image-input.test.tsx selectors encoded the dual-role anti-pattern being removed**
- **Found during:** Task 12-05-02 (post-refactor `npm run test` verification step)
- **Issue:** All 8 tests in `src/__tests__/admin/image-input.test.tsx` selected the dropzone via `getByRole('button', { name: /drop an image here, or click to browse/i })`. After the refactor, the drag region is `role="region"` (not button) and the headline is `"Drop an image here"` (no `, or click to browse`). All 8 selectors would fail.
- **Fix:** Updated each test to use the post-refactor selectors:
  - Drop events: `getByRole('region', { name: /image upload/i })`
  - Click-to-browse + keyboard: `getByRole('button', { name: /browse files/i })`
  - Added a new positive-assertion anti-pattern guard in the first test that explicitly asserts `queryByRole('button', { name: /image upload/i })` returns null. This catches any future regression that re-merges the drag region and click target back into a single button role.
- **Files modified:** `src/__tests__/admin/image-input.test.tsx`
- **Verification:** Targeted run `npm run test -- --run src/__tests__/admin/image-input.test.tsx` → 8/8 passing. Full suite `npm run test` → 390/390 passing (identical to baseline). Test count unchanged; assertion intent unchanged.
- **Committed in:** `b1553c4`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking issue)
**Impact on plan:** The deviation was anticipated by the plan's `done` criterion for Task 2 (`Both the existing image-upload tests (if any) and the existing E2E specs that interact with the image input continue to pass; the inner Button's text "Browse files" replaces the old combined headline phrase "or click to browse"`) — passing tests is the gate; how the selectors are spelled is implementation detail. The new anti-pattern guard is a value-add that hardens the refactor against future regression.

## Issues Encountered

None. Both tasks executed first-try after the test-selector update; all gates green.

## Threat Surface

Per plan threat model: zero new trust boundaries. The DropZone refactor is purely presentational + event-forwarding — same drop validation (T-12-05-01), same MAX_IMAGE_BYTES rejection (T-12-05-02), same hidden-file-input-not-focusable contract (T-12-05-03), same client-trust-bounded ARIA labels (T-12-05-04). Phase 11's `get-upload-url` Edge Function (server-side gatekeeper) remains the authoritative validation surface.

## Threat Flags

None.

## Sweep Tally — UIDN-03 Site Closure

| Site | Plan | Status |
|------|------|--------|
| D-13 `ImageInput.tsx:108` (dual-role button → DropZone region + Browse Button) | 12-05 | **Closed (this plan)** |
| D-14 `SuggestionForm.tsx:140 + :163` (imperative button → TanStack `<Link>`) | 12-02 | Closed in Wave 1 |
| D-15 `SearchBar.tsx:22` (native button clear-X → `<Button variant=ghost size=icon>`) | 12-01 | Closed in Wave 1 |
| (FOLLOWUP-LIST-CARDS — deferred to v1.3) | n/a | Stays deferred per D-19 |

All four locked UIDN-03 sweep sites are now closed. Plan 06 closure will check off UIDN-03 in REQUIREMENTS.md traceability + emit the final audit-baseline flip.

## Next Phase Readiness

- **DropZone is reusable.** The component is decoupled from `ImageInput`'s state — any future drag-and-drop surface (e.g., bulk poll-import CSV in v1.3) can import `DropZone` from `@/components/suggestions/form/DropZone` and pass its own state hooks.
- **Anti-pattern guard in tests.** Future contributors who try to re-merge the drag region and the click target back into one element will see the new test assertion fail. The pattern is locked.
- **Test count unchanged.** 390/390 passing — Plan 05 added one assertion to an existing test and retargeted seven selectors; no new test files, no skipped tests.
- **No new dependencies.** DropZone reuses `Button`, `cn`, and `lucide-react` icons already in the bundle. Bundle delta is +93 lines source / minimal gzipped size delta (sub-1KB).
- **No new EFs, no DB changes, no RLS changes.** Same upload path (`uploadImage` → `get-upload-url` EF → signed-URL upload → Storage). Phase 12 Plan 05 ships zero backend surface change.

## Self-Check: PASSED

- `src/components/suggestions/form/DropZone.tsx`: FOUND
- `src/components/suggestions/form/ImageInput.tsx`: FOUND (modified)
- `src/__tests__/admin/image-input.test.tsx`: FOUND (modified)
- DropZone exports `DropZone`: FOUND (named export)
- DropZone has `role="region"` + `aria-label="Image upload"`: FOUND
- DropZone has inner Button with `aria-label="Browse files"`: FOUND
- DropZone has `variant="outline"`: FOUND
- ImageInput imports `DropZone` from `'./DropZone'`: FOUND
- ImageInput renders `<DropZone>`: FOUND
- ImageInput no longer has a `<button>` with drag handlers: VERIFIED (grep returns no match)
- Commit `ca6abac` (Task 1): FOUND in git log
- Commit `b1553c4` (Task 2): FOUND in git log
- `npm run lint`: exit 0
- `npx tsc -b`: exit 0
- `npm run test`: 390 / 390 passing
- No STATE.md or ROADMAP.md modifications (parallel-executor contract honored)

---
*Phase: 12-admin-ui-user-ui-uidn-03-sweep*
*Plan: 05*
*Completed: 2026-05-12*
