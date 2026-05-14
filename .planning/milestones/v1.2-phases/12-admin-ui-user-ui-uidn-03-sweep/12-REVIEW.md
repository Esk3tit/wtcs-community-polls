---
phase: 12-admin-ui-user-ui-uidn-03-sweep
reviewed: 2026-05-12T19:15:00Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - src/components/admin/AdminSuggestionRow.tsx
  - src/components/suggestions/SuggestionCard.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 12 — Code Review (Scoped Re-Review)

**Reviewed:** 2026-05-12
**Depth:** deep (with cross-file analysis against `src/components/ui/alert.tsx`, `src/components/admin/SuggestionKebabMenu.tsx`, and `12-UI-SPEC.md`)
**Scope:** 2 files re-reviewed at the orchestrator's direction. Verifies the 3 known findings from `12-UI-REVIEW.md` (commit b5ddc42) and scans for additional code-quality defects a pure UI auditor would miss.
**Status:** issues_found

## Summary

All 3 known UI-REVIEW findings are reproduced in the current source and remain unfixed. In addition, the deep scan surfaced 5 new defects: 2 WARNING (loose status type-narrowing patterns that propagate unsafe `as` casts) and 3 lower-severity correctness / consistency issues. The BLOCKER is unchanged: a contract-locked accessibility ARIA label is still a generic toggle phrase.

The two files are tightly coupled to the `12-UI-SPEC.md` contract; most of the new issues cluster around inconsistent treatment of `suggestion.status` across the two components (whitelist-by-inclusion in admin, whitelist-by-exclusion in voter) and unchecked type assertions on `suggestion.resolution` / `suggestion.status` in `SuggestionCard` that would silently mis-render for any unrecognized future enum value.

---

## Critical Issues

### CR-01: AdminSuggestionRow Switch `aria-label` is a static generic string — contract breach

**File:** `src/components/admin/AdminSuggestionRow.tsx:93`
**Confirms:** UI-REVIEW BLOCKER #1 (still unfixed)

**Issue:**
Line 93 reads `aria-label="Toggle results visibility"`. UI-SPEC §VIS-07 row "Switch primitive" and §Accessibility Contract both lock a state-mirroring pattern (Radix convention so screen readers announce what is currently true, not the action that will fire):

> `aria-label={'Results currently ' + (resultsHidden ? 'hidden' : 'visible')}` — D-06 mirrors current state

The visible action label (lines 96-98) already follows the locked action-form pattern ("Hide results" / "Show results"), but the ARIA label does not mirror the current state. Screen-reader admins hear the same generic phrase regardless of state and cannot tell from the announcement alone whether results are currently hidden or visible — they would have to infer from the hidden-on-`sm` Eye/EyeOff icon, which is `aria-hidden`. That is exactly the inference step the locked spec was written to remove.

This is a written-contract breach against a locked accessibility spec, and the spec calls the convention out twice by name (VIS-07 + Accessibility Contract).

**Fix recipe (exact line replacement):**

Line 93 currently:
```tsx
            aria-label="Toggle results visibility"
```

Replace with:
```tsx
            aria-label={resultsHidden ? 'Results currently hidden' : 'Results currently visible'}
```

No other lines change. TEST-13 Playwright spec targets `[data-testid="visibility-switch-${s.id}"]` (line 94), not the ARIA label, so this is test-churn-free.

---

## Warnings

### WR-01: VIS-08 EyeOff icon inherits Alert `text-current`, not `text-muted-foreground`

**File:** `src/components/suggestions/SuggestionCard.tsx:144`
**Cross-file evidence:** `src/components/ui/alert.tsx:7` cva includes `[&>svg]:text-current`
**Confirms:** UI-REVIEW WARNING #2 (still unfixed)

**Issue:**
Line 144 renders `<EyeOff className="h-4 w-4" aria-hidden="true" />` with no color class. The parent `Alert` primitive's cva (`alert.tsx:7`) forces `[&>svg]:text-current` on every direct SVG child. With the `default` Alert variant (line 11: `bg-card text-card-foreground`), the icon therefore takes `text-card-foreground` — full-contrast foreground, not the muted treatment.

UI-SPEC §Color table row "VIS-08 EyeOff icon" promises `text-muted-foreground` ("neutral, not destructive — the hidden state is admin policy, not an error"). Currently the icon visually competes with the Alert title at the same color weight, weakening the hierarchy the spec explicitly designed.

Cascade order: Tailwind's specificity-via-merge plus the fact that an explicit `text-muted-foreground` on the `<EyeOff>` will override `[&>svg]:text-current` (more-specific direct-element class vs descendant-pseudo selector). Verified override path works.

**Fix recipe (exact line replacement):**

Line 144 currently:
```tsx
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
```

Replace with:
```tsx
                    <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
```

One token added (`text-muted-foreground`). No other lines change.

---

### WR-02: AdminSuggestionRow right cluster — Switch wrap vs kebab baseline asymmetry on `< sm`

**Files:** `src/components/admin/AdminSuggestionRow.tsx:87` (Switch `<label>` wrap), `src/components/admin/SuggestionKebabMenu.tsx:65` (kebab `Button` `h-11 w-11`)
**Confirms:** UI-REVIEW WARNING #3 (still unfixed — visual; needs human verification at < 640px)

**Issue:**
Right cluster pairs:
- A `min-h-[44px]` flex `<label>` that wraps `Switch + (label OR Eye/EyeOff icon) + optional Loader2`. No fixed width — collapses to the natural content width.
- A fixed `h-11 w-11` (44×44 square) icon Button for the kebab.

Both meet WCAG 2.5.8 (≥ 44×44 touch target), so the spec contract is not breached. The concern is purely visual: on `< sm` viewports the Switch wrap loses the textual label (line 96 `hidden sm:inline`) and shrinks to roughly `Switch (h-5 w-9 shadcn default ≈ 36px) + 8px gap + EyeOff 16px ≈ 60px wide × variable height` while the kebab stays 44×44. The visual asymmetry is "narrow control + 44×44 square block" on small viewports.

This was flagged as needs-human-verify in the UI-REVIEW because Phase 12 surfaces sit behind Discord OAuth and the screenshot harness cannot reach them.

Code-review verdict (independent of visual confirmation): class composition in source matches the UI-REVIEW description exactly. The `min-h-[44px]` on the `<label>` does NOT enforce a minimum *width*, so on `< sm` the cluster has a real width delta.

**Fix recipe (one of two):**

Option A — enforce mobile minimum width on the Switch wrap:

Line 87 currently:
```tsx
        <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer select-none">
```

Replace with:
```tsx
        <label className="inline-flex items-center gap-2 min-h-[44px] min-w-11 sm:min-w-0 cursor-pointer select-none">
```

(`min-w-11` = 44px in Tailwind v4; pairs with kebab's `w-11` for visual width parity on `< sm` only.)

Option B — accept asymmetry, document the decision:

Add a WHY comment above line 86 (the right-cluster `<div>`):
```tsx
        {/* Right cluster: Switch+label wrap (variable width) + 44×44 kebab. */}
        {/* Visual width asymmetry on < sm is accepted — both elements meet */}
        {/* WCAG 2.5.8 ≥ 44px touch target via min-h-[44px] (label) and h-11 w-11 (kebab). */}
```

Pick A if you want visual parity; pick B if the team accepts the asymmetry. Either resolves the finding. The UI-REVIEW called the user impact "minor polish, not contract-breaking."

---

### WR-03: SuggestionCard uses unchecked type assertion on `suggestion.status` — silent mis-narrow risk

**File:** `src/components/suggestions/SuggestionCard.tsx:159`
**Severity:** WARNING (new finding — not in UI-REVIEW)

**Issue:**
Line 159 passes `suggestion.status as 'active' | 'closed'` to `<ChoiceButtons>`'s `pollStatus` prop. This is a bare type assertion with no runtime guard. If `suggestion.status` is anything other than `'active'` or `'closed'` (e.g., a future `'archived'`, `'draft'`, `'cancelled'`, or any DB drift), the assertion lies to the downstream consumer. `ChoiceButtons` will then branch on `pollStatus === 'active'` / `'closed'` and silently take the wrong branch.

This is inconsistent with the sibling component `AdminSuggestionRow.tsx:31-34`, which uses a defensive `normalizeResolution` helper to map unknown raw strings to `null` rather than blindly casting. Apply the same discipline here.

Compounding issue: at line 38 the *same component* derives `isClosed = suggestion.status !== 'active'` (whitelist-by-exclusion). So inside `SuggestionCard`, `status='archived'` would be treated as "closed" by `isClosed` but would still be passed through to `<ChoiceButtons>` by the line-159 cast as if it were `'active' | 'closed'`. The two derived values disagree on the same input.

Cross-file evidence of inconsistency:
- `AdminSuggestionRow.tsx:45`: `const isClosed = s.status === 'closed'` (whitelist-by-inclusion — unknown statuses are "active")
- `SuggestionCard.tsx:38`: `const isClosed = suggestion.status !== 'active'` (whitelist-by-exclusion — unknown statuses are "closed")

The two surfaces classify the same DB value differently. For the v1.0 schema where `status ∈ {'active', 'closed'}`, this is a no-op. The moment a third status is introduced (audit_log already exists for forensic states; `archived` is plausible), the surfaces diverge.

**Fix recipe (minimal — match AdminSuggestionRow's pattern):**

Add a narrowing helper near the top of `SuggestionCard.tsx` (after line 14):
```tsx
const VALID_POLL_STATUSES = ['active', 'closed'] as const
type PollStatus = (typeof VALID_POLL_STATUSES)[number]

function normalizeStatus(raw: string): PollStatus {
  return VALID_POLL_STATUSES.includes(raw as PollStatus) ? (raw as PollStatus) : 'closed'
}
```

Replace line 38:
```tsx
  const isClosed = suggestion.status !== 'active'
```
with:
```tsx
  const pollStatus = normalizeStatus(suggestion.status)
  const isClosed = pollStatus === 'closed'
```

Replace line 159:
```tsx
                  pollStatus={suggestion.status as 'active' | 'closed'}
```
with:
```tsx
                  pollStatus={pollStatus}
```

After this change, `<ChoiceButtons>` receives a validated narrow value, the `isClosed` derivation is internally consistent, and unknown future statuses fall safely into "closed" (read-only, no voting affordance) — defensive default for an open list of values.

---

### WR-04: SuggestionCard casts `suggestion.resolution` to `ResolutionStatus` without narrowing

**File:** `src/components/suggestions/SuggestionCard.tsx:63`
**Severity:** WARNING (new finding — not in UI-REVIEW)

**Issue:**
Line 63 reads `<ResolutionBadge resolution={suggestion.resolution as ResolutionStatus} />`. Same pattern problem as WR-03: a bare `as` assertion with no runtime check. `suggestion.resolution` is typed as `string | null` (line 14 type chain: `SuggestionWithChoices` → DB row → nullable text), but `ResolutionBadge` expects a constrained enum.

The conditional `hasResolution` at line 39 (`isClosed && suggestion.resolution`) guards against `null` and empty string — but does NOT guard against unknown values. Any DB row with `resolution='wontfix'` or `resolution='deferred'` (future enum additions) would be passed to `ResolutionBadge` as if it were a valid `ResolutionStatus`, and `ResolutionBadge` would either render incorrectly or fall to whatever default branch it has.

Compare to `AdminSuggestionRow.tsx:31-34`, which has the `normalizeResolution` helper that maps unknown raws to `null`. SuggestionCard should reuse that helper or implement its own.

Coupling observation: the `normalizeResolution` helper currently lives privately inside `AdminSuggestionRow.tsx`. If it is shared (which is now justified by this finding), promote it to a utility module like `src/lib/poll-status.ts` and import in both files.

**Fix recipe:**

Option A — promote `normalizeResolution` to a shared util.

Create `src/lib/poll-status.ts`:
```ts
import type { Resolution } from '@/hooks/useClosePoll'

const VALID_RESOLUTIONS: Resolution[] = ['addressed', 'forwarded', 'closed']

export function normalizeResolution(raw: string | null): Resolution | null {
  if (raw === null) return null
  return VALID_RESOLUTIONS.includes(raw as Resolution) ? (raw as Resolution) : null
}
```

In `AdminSuggestionRow.tsx`, replace lines 29-34 (the local declarations) with an import:
```tsx
import { normalizeResolution } from '@/lib/poll-status'
```

In `SuggestionCard.tsx`, import the helper and update line 39 + line 63:

After line 14, add:
```tsx
import { normalizeResolution } from '@/lib/poll-status'
```

Line 39 currently:
```tsx
  const hasResolution = isClosed && suggestion.resolution
```
Replace with:
```tsx
  const resolution = isClosed ? normalizeResolution(suggestion.resolution) : null
  const hasResolution = resolution !== null
```

Line 63 currently:
```tsx
              resolution={suggestion.resolution as ResolutionStatus}
```
Replace with:
```tsx
              resolution={resolution as ResolutionStatus}
```

(`resolution` is narrowed to `Resolution | null`; the `as ResolutionStatus` is now safe because `hasResolution` guarantees non-null at this branch. Better still: if `Resolution` and `ResolutionStatus` share members, drop the cast entirely by aligning the two types.)

Option B — inline the narrow in SuggestionCard only (smaller blast radius):

In `SuggestionCard.tsx`, add a local function above the component definition, and use it the same way as Option A but without touching `AdminSuggestionRow.tsx`. Acceptable interim; do Option A in a follow-up.

---

## Info

### IN-01: SuggestionCard `isOpen` initializer becomes stale if `is_pinned` changes after mount

**File:** `src/components/suggestions/SuggestionCard.tsx:35`
**Severity:** Info (correctness — narrow blast radius)

**Issue:**
`useState(suggestion.is_pinned)` initializes `isOpen` from the prop on mount only. If the admin unpins a card via the kebab menu while the voter has it open in another tab, the prop `suggestion.is_pinned` will eventually update via the next `useVoteCounts` poll cycle (or `useSuggestions` re-fetch), but the local `isOpen` state will NOT react — it stays at whatever the user last set. Worst case: a card that was pinned-on-mount stays expanded with no chevron affordance (line 185 hides ChevronDown when `!isPinned` is false) until the user collapses it through… nothing, because the outer click handler at line 95 is also conditionally not attached when the card was originally pinned.

In practice the card will likely re-mount when the list re-orders (pinned cards move to the top), so the prop change usually coincides with a remount. Not provable without testing the keying behavior of the parent list.

**Fix recipe (optional — defensive sync):**

Replace line 35:
```tsx
  const [isOpen, setIsOpen] = useState(suggestion.is_pinned)
```

with a more defensive pattern that syncs on prop change:
```tsx
  const [isOpen, setIsOpen] = useState(suggestion.is_pinned)
  // Sync open state when pin state flips externally (admin unpinned while card was open).
  useEffect(() => {
    setIsOpen(suggestion.is_pinned)
  }, [suggestion.is_pinned])
```

Plus update line 1 to `import { useEffect, useState } from 'react'`.

Trade-off: this also forces the card closed if a voter expanded a non-pinned card and then the admin pins it — which is probably fine behavior. Evaluate against UX intent before applying. Logged as Info because in v1.0 the parent list likely keys cards on `suggestion.id` and the issue may not manifest.

---

### IN-02: `'(unknown)'` fallback string for missing choice label

**File:** `src/components/suggestions/SuggestionCard.tsx:140`
**Severity:** Info

**Issue:**
Line 140 displays `'(unknown)'` if `userChoiceId` doesn't resolve against `suggestion.choices`. The UI-REVIEW called this a "defensive correctness win" — agreed, defensive is good. But the user-facing string `'(unknown)'` is engineer-speak. If this branch ever fires for a real voter (e.g., a choice was deleted concurrently with the voter's session), they'll see literal parentheses around a generic word.

Lower-friction alternative: `'your response'` (lowercase, descriptive) or fall back to the `userChoiceId` truncated. Or — given this represents a real data inconsistency — log to Sentry as a breadcrumb so the team learns when it fires.

**Fix recipe (optional polish):**

Line 140 currently:
```tsx
                      {suggestion.choices.find((c) => c.id === userChoiceId)?.label ?? '(unknown)'}
```

Replace with:
```tsx
                      {suggestion.choices.find((c) => c.id === userChoiceId)?.label ?? 'your response'}
```

Or, to make the fallback observable:
```tsx
                      {(() => {
                        const choice = suggestion.choices.find((c) => c.id === userChoiceId)
                        if (!choice) {
                          // Choice was deleted concurrent with voter's session — defensive label.
                          return 'your response'
                        }
                        return choice.label
                      })()}
```

Not a contract item — copy is not locked in UI-SPEC for this fallback branch. Logged as Info because it's a low-frequency edge case.

---

### IN-03: `hasResolution` is boolean-coerced from a falsy/truthy string

**File:** `src/components/suggestions/SuggestionCard.tsx:39`
**Severity:** Info (style / typing precision)

**Issue:**
Line 39: `const hasResolution = isClosed && suggestion.resolution`. The right operand is `string | null`, so the result type is `boolean | string | null` (TS infers the union). Used at line 61 as `{hasResolution && (...)}`, which still works — JS sees the union as truthy/falsy correctly. The issue is the name lies about the type: `hasResolution` reads as boolean but is actually `string | boolean | null`.

If `suggestion.resolution` happens to be the empty string `''` (which the DB CHECK constraint may or may not permit; uncertain without consulting migration files), `hasResolution` evaluates to `''` — still falsy in `&&`, so the conditional render works. Minor.

WR-04's fix supersedes this finding: after `normalizeResolution` narrows the value, `const hasResolution = resolution !== null` is genuinely boolean. So this is implicitly resolved by adopting WR-04's fix.

**Fix recipe (subsumed by WR-04):** see WR-04 fix recipe; this issue disappears.

If WR-04 is deferred, narrow inline:
```tsx
  const hasResolution = Boolean(isClosed && suggestion.resolution)
```

---

## Notes for the orchestrator

- **All 3 UI-REVIEW findings are reproduced** in the current source. CR-01 (BLOCKER) is a one-line ARIA fix; WR-01 is a one-token Tailwind class addition; WR-02 needs either a one-line class addition or a 3-line WHY comment depending on the team's call.
- **WR-03 and WR-04 cluster around the same root cause**: unchecked `as` assertions on `suggestion.status` / `suggestion.resolution` in `SuggestionCard.tsx`. The fix-recipe in WR-04 (promote `normalizeResolution` to `src/lib/poll-status.ts` and reuse) is the cleanest path; WR-03 reuses the same module pattern. Doing both together is one PR.
- **No security findings** — these are pure presentational components consuming pre-validated data via hooks. No user input flows through them.
- **No dead code, no commented-out code, no debug artifacts** (no `console.log`, no `debugger`, no leftover TODOs in either file beyond the `// Creator avatar placeholder` WHY-comment on `SuggestionCard.tsx:173`, which is legitimate).
- **Lint and typecheck pass** per the upstream UI-REVIEW note (not re-run in this scoped review — orchestrator can re-run if desired).
- **TEST-13 Playwright spec** targets `data-testid` locators, not ARIA labels or color classes, so CR-01 / WR-01 fixes are test-churn-free.

---

_Reviewed: 2026-05-12T19:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Files reviewed: 2_
