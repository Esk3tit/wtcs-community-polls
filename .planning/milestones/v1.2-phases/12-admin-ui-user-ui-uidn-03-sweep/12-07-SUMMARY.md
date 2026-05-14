---
phase: 12-admin-ui-user-ui-uidn-03-sweep
plan: 07
subsystem: admin-suggestion-form
tags:
  - uidn-03
  - d-14
  - gap-closure
  - test-3-uat
dependency_graph:
  requires:
    - 12-02 (UIDN-03 D-14 partial — only the header back-link landed)
  provides:
    - SuggestionForm Cancel renders as <a href="/admin">, restoring browser-native new-tab gestures (middle-click, cmd-click, right-click)
    - UIDN-03 D-14 sweep is now fully complete across both back-link sites in SuggestionForm.tsx
  affects:
    - .planning/phases/12-admin-ui-user-ui-uidn-03-sweep/12-UAT.md (Test 3 gap closes)
tech_stack:
  added: []
  patterns:
    - shadcn Button `asChild` slot wrapping a TanStack Router `<Link>` (matches the header-link pattern at the same surface)
key_files:
  created: []
  modified:
    - src/components/suggestions/form/SuggestionForm.tsx
decisions:
  - UIDN-03 D-14 (locked in 12-CONTEXT.md) applied to the Cancel button — declarative `<Link>` over imperative `navigate(...)` so browser-native new-tab gestures work
  - Preserved `variant="ghost"` (live code's actual variant) rather than the gap-brief's example `outline`; the visual contract from before the regression is unchanged
  - `useNavigate` import retained — still used by `handleSubmit` for post-submit-success navigation with `?tab=suggestions` (lines 127, 130)
metrics:
  duration: ~3 minutes (single 3-line Edit + gate)
  completed: 2026-05-12
requirements:
  - UIDN-03
---

# Phase 12 Plan 07: UAT Gap Closure — SuggestionForm Cancel Button (UIDN-03 D-14)

Swap the suggestion-form Cancel button from a native `<button onClick={navigate}>` to a shadcn `<Button asChild>` wrapping a TanStack `<Link to="/admin">`, completing the UIDN-03 D-14 sweep that 12-02's SUMMARY claimed but only partially shipped.

## What Shipped

### Exact Diff Applied

`src/components/suggestions/form/SuggestionForm.tsx` (lines 277–279):

Before:
```tsx
<Button type="button" variant="ghost" onClick={() => navigate({ to: '/admin' })}>
  Cancel
</Button>
```

After:
```tsx
<Button asChild variant="ghost">
  <Link to="/admin">Cancel</Link>
</Button>
```

Three lines replaced. No other edits to the file.

### Preserved Surfaces

- **`useNavigate` import on line 2:** retained — `handleSubmit` still calls `navigate({ to: '/admin', search: { tab: 'suggestions' } })` after successful create (line 127) and successful update (line 130). Removing the import or hook would break post-submit navigation.
- **`Link` import on line 2:** already present (used by the loadError-branch header back-link on line 144 and the main-return header back-link on line 166). No new import needed.
- **`variant="ghost"`:** preserved against the gap-brief's `outline` example. The live pre-regression code rendered the ghost variant; matching it keeps the visual contract intact.
- **Loaded-error branch (lines 144–149) and main-return header (lines 166–171):** both already `<Link>`-based and correct — not touched.

### Why This Was Needed

Plan 12-02's SUMMARY claimed UIDN-03 D-14 swapped both back-link sites (`SuggestionForm.tsx:140 + :163`) to TanStack `<Link>`. In practice only the header link landed; the bottom Cancel button regressed to (or stayed on) the imperative `<button onClick={navigate}>` shape. UAT Test 3 surfaced this: the header link supports middle-click → new tab, the Cancel button does not. The Cancel button is a real back-navigation affordance and should match the header's semantics.

By using `Button asChild` with the Radix Slot, the button forwards its styling onto the `<Link>` child, which TanStack renders as `<a href="/admin">`. Left-click is still intercepted by TanStack Router for SPA navigation; middle-click, cmd-click, and right-click fall through to the browser's native anchor handling.

## Verification Results

### Local Gate (393/393 baseline preserved)

| Gate | Result | Notes |
| ---- | ------ | ----- |
| `npm run lint` | exit 0 | clean |
| `npx tsc -b` | exit 0 | no type errors |
| `npm run test -- --run` | 393/393 passed (41 files) | matches Phase 12 UAT baseline exactly |

Duration of the full vitest run: 3.72s.

### Source Pattern Checks

Positive (Cancel swap landed):
```
rg -n -U --multiline 'Button asChild variant="ghost">\s*\n\s*<Link to="/admin">Cancel' src/components/suggestions/form/SuggestionForm.tsx
277:          <Button asChild variant="ghost">
278:            <Link to="/admin">Cancel</Link>
```

Negative (old handler removed):
```
rg -n "onClick=\\{\\(\\) => navigate\\(\\{ to: '/admin' \\}\\)\\}" src/components/suggestions/form/SuggestionForm.tsx
(no matches — regression cleared)
```

`useNavigate` still in use for post-submit navigation:
```
2:import { useNavigate, Link } from '@tanstack/react-router'
25:  const navigate = useNavigate()
127:      if (r.ok) navigate({ to: '/admin', search: { tab: 'suggestions' } })
130:      if (r.ok) navigate({ to: '/admin', search: { tab: 'suggestions' } })
```

### Test Locator Audit

`rg -n -i "cancel" src/__tests__ e2e` returned zero matches at plan time and zero matches after the edit. No test file queried the Cancel button by `role="button"` or by visible text, so no locator updates were needed. The 393/393 baseline holds without test edits.

## Commits

| Step | Type | Message | Hash |
| ---- | ---- | ------- | ---- |
| 1 | fix | `fix(12-07): swap SuggestionForm Cancel to TanStack Link (UIDN-03 D-14)` | `65d85a6` |

## Deviations from Plan

None — plan executed exactly as written.

The plan anticipated possible test-locator updates if any test queried Cancel by `getByRole('button', { name: /cancel/i })`. None existed in `src/__tests__` or `e2e`, so the locator-audit branch of the plan was not exercised. The plan called this out explicitly ("verify, do not assume") — verification confirmed no test edits required.

## UAT Test 3 Closure

The Phase 12 UAT recorded Test 3 (Admin SuggestionForm Back-Links UIDN-03 D-14) as `issue` with severity `major`, reported as "the cancel button doesn't support new tab but the back to admin header link does." This plan closes that gap:

- **Header back-link (lines 144–149 + 166–171):** already on `<Link>` since 12-02 — supports new-tab gestures.
- **Cancel button (line 277):** now on `<Link>` via this plan — supports new-tab gestures.

Both back-link sites in `SuggestionForm.tsx` now render through TanStack `<Link to="/admin">`. The UIDN-03 D-14 sweep is fully covered.

Browser-side observation of middle-click → new tab on `/admin/suggestions/new` Cancel is the final UAT confirmation step (manual, not automated). The DOM contract is now structurally correct: `<a href="/admin" class="...ghost variant classes...">Cancel</a>`.

## Self-Check: PASSED

- `src/components/suggestions/form/SuggestionForm.tsx` modified — FOUND
- Commit `65d85a6` present in `git log --oneline` — FOUND
- Lint exit 0 — FOUND
- tsc exit 0 — FOUND
- vitest 393/393 — FOUND
- Old `onClick` handler removed — FOUND (no matches in source)
- New `<Button asChild>` + `<Link to="/admin">Cancel` present — FOUND (lines 277–279)
- `useNavigate` import retained + used at handleSubmit call sites — FOUND
