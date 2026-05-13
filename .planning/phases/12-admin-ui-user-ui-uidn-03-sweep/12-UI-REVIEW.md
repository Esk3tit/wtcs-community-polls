---
phase: 12-admin-ui-user-ui-uidn-03-sweep
audited: 2026-05-12T18:03:00Z
baseline: 12-UI-SPEC.md (approved 2026-05-12) + .planning/DESIGN-SYSTEM.md
overall_score: 21
overall_max: 24
pillars:
  copywriting: 4
  visuals: 3
  color: 4
  typography: 4
  spacing: 4
  experience_design: 2
findings:
  blocker: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
screenshots: .planning/ui-reviews/12-20260512-180333/
---

# Phase 12 — UI Review

**Audited:** 2026-05-12
**Baseline:** `12-UI-SPEC.md` (approved 2026-05-12) + `.planning/DESIGN-SYSTEM.md` (ADR-001: new-york / Neutral)
**Screenshots:** Captured (7 viewports) — Phase 12's actual surfaces (admin Switch row, voter VIS-08 Alert, SuggestionForm Checkbox, DropZone) all sit behind Discord OAuth, so visual evidence is limited to the unauthenticated landing page. Body of the audit is code + spec cross-check.
**Screenshot directory:** `.planning/ui-reviews/12-20260512-180333/`

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every locked Phase 12 string is byte-exact verbatim (label, helper, Alert title, toast pair, voter's-choice line, error toast). No generic fallback labels in new surfaces. |
| 2. Visuals | 3/4 | Layout/hierarchy correct; icon-only buttons all have `aria-label`. Switch + kebab right-cluster on `AdminSuggestionRow` mixes a `min-h-[44px]` label with an `h-11` icon button — vertical-baseline asymmetry visible only at small viewports; cannot screenshot-confirm. |
| 3. Color | 4/4 | 12 total `text-/bg-/border-primary` usages across `src/` (well under the 10% accent budget); zero hardcoded hex/rgb; Phase 12's two new accent applications (Checkbox checked + Switch ON) ride the shadcn primitives' default. |
| 4. Typography | 4/4 | 5 sizes total project-wide, all in the locked scale. 2 weights only (`font-medium`, `font-semibold`). No new sizes introduced. |
| 5. Spacing | 4/4 | All arbitrary values in Phase 12 files are the four UI-SPEC-declared exceptions (`min-h-[44px]`, `min-h-[72px]`, `min-h-[160px]`). Token usage matches `gap-2`, `gap-3`, `p-4`, `space-y-2`, `space-y-6` per spec. |
| 6. Experience Design | 2/4 | Optimistic-flip flow, per-row pending Set, inflight ref, revert-on-error all correct. **BUT:** Switch `aria-label="Toggle results visibility"` is a **direct violation** of UI-SPEC §VIS-07 + Accessibility Contract which locks a state-mirroring `"Results currently {hidden\|visible}"` (Radix convention). On-the-record contract breach. |

**Overall: 21/24**

---

## Top 3 Priority Fixes

### 1. [BLOCKER] AdminSuggestionRow Switch `aria-label` does not reflect current state

- **File:** `src/components/admin/AdminSuggestionRow.tsx:93`
- **Current:** `aria-label="Toggle results visibility"`
- **UI-SPEC §VIS-07 + §Accessibility Contract (locked, two places):**
  - "`aria-label={'Results currently ' + (resultsHidden ? 'hidden' : 'visible')}` — D-06 mirrors current state"
  - "Switch has `aria-label` reflecting current state (not next state — Radix convention so screen readers announce what is currently true)"
- **User impact:** Screen-reader users hear "Toggle results visibility" on every focus regardless of state; they cannot tell from the announcement whether results are currently shown or hidden. Forces them to infer state via the visible Eye/EyeOff icon, which is `aria-hidden`. The whole point of the locked-spec Radix pattern was to remove that inference step.
- **Fix:** Replace line 93 with `aria-label={resultsHidden ? 'Results currently hidden' : 'Results currently visible'}`. One-line change. TEST-13 selects by `data-testid`, not `aria-label`, so no test churn.

### 2. [WARNING] VIS-08 EyeOff icon missing `text-muted-foreground`

- **Files:** `src/components/suggestions/SuggestionCard.tsx:144`, `src/components/ui/alert.tsx:6` (`[&>svg]:text-current`)
- **Issue:** UI-SPEC §Color table row "VIS-08 EyeOff icon | `text-muted-foreground` | Lucide `EyeOff` 16px adjacent to the Alert title; neutral, not destructive — the hidden state is admin policy, not an error". Actual: the `EyeOff` element has no color class; the Alert primitive's cva forces `[&>svg]:text-current`, so the icon takes the Alert's foreground color (full card-foreground contrast), not muted-foreground.
- **User impact:** Icon visually competes with the Alert title rather than sitting back.
- **Fix:** `<EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />` — Tailwind's `text-muted-foreground` overrides via specificity through `tailwind-merge`.

### 3. [WARNING] AdminSuggestionRow right cluster baseline asymmetry on `< sm`

- **Files:** `src/components/admin/AdminSuggestionRow.tsx:87` (Switch wrapper `min-h-[44px]`), `src/components/admin/SuggestionKebabMenu.tsx:65` (kebab Button `h-11 w-11`)
- **Issue:** Switch label-wrap is `min-h-[44px]` (44px target via flex), but the kebab is a fixed `h-11 w-11` (44px square). On `< sm`, the Switch loses its visible label and shows only `<Switch> + <EyeOff>` icon (no min-width); the kebab stays a 44×44 button. UI-SPEC §Spacing locks both to ≥ 44px but does not lock visual width parity.
- **User impact:** On 320–375px viewports, the Switch+icon cluster is visually narrower than the kebab; right cluster reads as "small thing + big thing". Cannot screenshot-confirm without auth.
- **Fix:** Bump Switch wrap to a fixed minimum width on mobile (`min-w-9 sm:min-w-0`) so the cluster aligns evenly, OR accept asymmetry as decorative and add an explicit decision note. Not contract-breaking; visual polish.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All Phase 12 locked strings present byte-exact:

| Locked copy | Location | Status |
|------------|----------|--------|
| `"Hide results from voters"` | `SuggestionForm.tsx:241` | ✓ Verbatim |
| Helper text (D-17): `"Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list."` | `SuggestionForm.tsx:245` | ✓ Verbatim |
| `"Hide results"` / `"Show results"` (D-06 action-form) | `AdminSuggestionRow.tsx:97` | ✓ Verbatim, two-state |
| `"Results temporarily hidden by admin"` (D-12 locked) | `SuggestionCard.tsx:145` | ✓ Verbatim |
| `"Your response: {label}"` (D-10) | `SuggestionCard.tsx:138` | ✓ Verbatim |
| `"Results hidden for: {title}"` / `"Results visible for: {title}"` (D-03) | `useToggleResultsVisibility.ts:37-38` | ✓ Verbatim, symmetric |
| `"Could not update visibility. Try again."` | `useToggleResultsVisibility.ts:31` | ✓ Phase 4 tone preserved |
| `"Drop an image here"` headline + `"JPG, PNG, or WebP · max 2 MB"` subtext | `DropZone.tsx:77-79` | ✓ Verbatim |
| `"Browse files"` Button label | `DropZone.tsx:90` | ✓ Verbatim |
| Edit-mode read-only addition (planner-added per cross-AI HIGH fix): `"Results currently hidden"` / `"Results currently visible"` + `"Toggle from the admin list to change visibility."` | `SuggestionForm.tsx:266, 270` | ✓ Resolves edit-mode no-op anti-pattern |

Generic-label scan turned up zero leakage into Phase 12 surfaces. Terminology contract preserved: VIS-06 admin-facing uses "voters" (REQUIREMENTS-verbatim, locked carveout); VIS-08 voter-facing Alert uses neutral "Results … by admin" with no "vote" leak.

### Pillar 2: Visuals (3/4)

**Hierarchy and focal points (UI-SPEC §Visual Hierarchy & Focal Points):**
- SuggestionForm primary focal (page heading + Title input) unchanged ✓
- AdminSuggestionRow pinned-row anchor unchanged; Switch is per-row inline control as locked ✓
- SuggestionCard hidden-state Alert composed correctly inside the slot where ResultBars would render ✓

**Icon-only / aria-label coverage:** all icon-only Buttons in Phase 12 surfaces carry `aria-label`:
- `SearchBar.tsx:28` — `aria-label="Clear search"` ✓
- `DropZone.tsx:87` — `aria-label="Browse files"` ✓
- `AdminSuggestionRow.tsx:93` — `aria-label="Toggle results visibility"` (present but wrong content — see Pillar 6) ⚠

**Visual finding (specific):** AdminSuggestionRow right cluster pairs a `min-h-[44px]` Switch+label wrap with a fixed `h-11 w-11` kebab Button. See Priority Fix #3.

### Pillar 3: Color (4/4)

**Primary-token usage count across all `src/`:** 12 occurrences total. Most are inside vendored shadcn primitives. Non-primitive primary usages:
- `ResultBars.tsx:39, 72` — voter-choice indicator (Phase 2, pre-existing)
- `SuggestionList.tsx:145` — focused-suggestion ring (Phase 5 deep-link, pre-existing)

Phase 12 adds two new accent applications via shadcn primitives:
1. **VIS-06 Checkbox checked** — via `data-[state=checked]:bg-primary` in `checkbox.tsx:15` ✓
2. **VIS-07 Switch ON** — via `data-[state=checked]:bg-primary` in `switch.tsx:20` ✓

Both ride the shadcn primitive's default; no Phase 12-introduced primary class outside the primitives. The 60/30/10 distribution holds.

**Hardcoded colors:** zero. `grep` for `#[0-9a-fA-F]` and `rgb(` in `src/**/*.tsx` returns nothing in Phase 12 files. All color comes from `hsl(var(--…))` tokens declared in `src/index.css`.

**Destructive token usage:** 34 occurrences across the codebase; Phase 12 introduces no new destructive applications (Switch is non-destructive per VIS-02 + D-01).

**Color pillar deviation (minor, captured under Pillar 6 fix #2):** VIS-08 `EyeOff` icon inherits `text-current` from the Alert cva, not `text-muted-foreground` as the spec table promised. Distribution remains correct; the muted-icon override is a one-line fix.

### Pillar 4: Typography (4/4)

**Sizes used (project-wide unique values):** 5 sizes — `text-xs` (52), `text-sm` (73), `text-base` (8), `text-lg` (9), `text-2xl` (7). Matches UI-SPEC's locked 4-size carryforward + existing page-heading `text-2xl`.

**Phase 12 touched files specifically:** `text-xs` (14), `text-sm` (13), `text-base` (1), `text-lg` (1), `text-2xl` (1). No new sizes introduced.

**Weights:** 2 weights — `font-medium` (49) + `font-semibold` (17). Implicit `font-normal`. Matches contract exactly.

**Specific VIS-08 hierarchy preservation:** SuggestionCard title is `text-lg font-medium` — unchanged from Phase 2. Alert title is `text-sm font-medium` (shadcn default). Card title remains top-line ✓.

### Pillar 5: Spacing (4/4)

**Token distribution (top 5 in Phase 12 touched files):**
- `gap-2` (46; right-cluster + Checkbox row)
- `gap-3` (12; VIS-06 row vertical + Switch-to-kebab cluster)
- `space-y-2` (12; VIS-06 helper section)
- `p-4` (11; Alert padding + AdminSuggestionRow padding)
- `p-5` (6; SuggestionCard padding)

**Arbitrary-value audit on Phase 12 files only:**
- `DropZone.tsx:58` — `min-h-[160px]` ✓ (UI-SPEC §Spacing locks this)
- `SuggestionForm.tsx:230, 251` — `min-h-[44px]` ✓ (WCAG 2.5.8 touch target)
- `AdminSuggestionRow.tsx:53` — `min-h-[72px]` ✓ (carried from Phase 4)
- `AdminSuggestionRow.tsx:87` — `min-h-[44px]` ✓ (WCAG touch target)

All four are spec-declared exceptions. Zero rogue arbitrary spacing.

DropZone container uses `px-4 py-8` instead of UI-SPEC §1's `p-8` — minor shape difference (16/32 vs 32/32). Read in context: more mobile-friendly for narrower viewports, same height anchor. Logged as observation, not finding — the spec text was prose, not a locked invariant.

### Pillar 6: Experience Design (2/4)

**Optimistic-flip UX (the heaviest scoring weight):**

What works:
- Per-row `pendingVisibility: Set<string>` (`AdminSuggestionsTab.tsx:38`) — multiple rows in-flight independently ✓
- Hook-level `inflightRef: Set<string>` (`useToggleResultsVisibility.ts:18`) guards rapid double-click ✓
- Discriminated return `{ ok: false, reason: 'inflight' | 'error' }` lets caller distinguish gate-trip from real failure; caller correctly returns early on `inflight` without touching pending state or reverting items (`AdminSuggestionsTab.tsx:190`) ✓
- Optimistic local flip → fire EF → revert + reconcile via fetchAll on real error → reconcile-only on success ✓
- In-flight `Loader2` + `disabled` Switch + `aria-busy="true"` all present (`AdminSuggestionRow.tsx:91-107`) ✓
- Toast copy is locked symmetric pair via Sonner (`useToggleResultsVisibility.ts:36-39`) ✓
- Sonner Toaster mounted in `__root.tsx:32` ✓

What fails (the score deduction):
- **Switch `aria-label="Toggle results visibility"` is a generic toggle phrase** (`AdminSuggestionRow.tsx:93`). UI-SPEC §VIS-07 row "ARIA" and §Accessibility Contract both lock the state-mirroring pattern. Without the state-mirror, screen-reader users get an unhelpful "Toggle results visibility" on every focus regardless of current state — defeats the locked Radix convention the spec explicitly cites by name. Contract breach. See Priority Fix #1.

**Voter Alert + own-choice surfacing (D-10):**
- `"Your response: {label}"` line above Alert ✓ (`SuggestionCard.tsx:137-142`)
- Resolves `userChoiceId` against `suggestion.choices` with `(unknown)` fallback — defensive correctness win not in spec ✓
- Three-way ternary precedence correct: `(voted && hidden) ? Alert : voted ? ResultBars : ChoiceButtons` ✓
- Live updates via the extended `useVoteCounts` 8s polling — `SuggestionList.tsx:42` destructures `resultsHidden`. Map-miss defaults to `false` per D-11 + RLS defense-in-depth ✓

**DropZone keyboard/screen-reader path (D-13):**
- Drag region `role="region"` + `aria-label="Image upload"` ✓
- Inner Browse Button keyboard-activatable; Tab+Enter/Space opens picker via `useRef` ✓
- Decorative icons `aria-hidden="true"` ✓
- Hidden file input is `className="hidden"` not `sr-only` — UI-SPEC §4c said `sr-only`. Acceptable because the Browse Button is the canonical entry; logged as minor deviation. Doesn't degrade real users.

**Disabled-state legibility:**
- Switch `disabled={isPendingVisibility}` + Radix `disabled:cursor-not-allowed disabled:opacity-50` ✓
- Form locks cascade through Input/Textarea/Choices/Image/Timer/Category disabled props ✓
- **Edit-mode Checkbox handling:** Renders as read-only Eye/EyeOff status row, not disabled Checkbox — planner's cross-AI HIGH fix. UI-SPEC §VIS-06 originally said "render in edit mode too" but planner correctly recognized update-poll EF doesn't accept `results_hidden`. Eye/EyeOff status row + helper text resolves the no-op anti-pattern. Strict-improvement deviation. ✓

**Why 2/4 and not 3/4:** The ARIA-label contract breach is the kind of single defect that fails the accessibility surface for the specific user class (screen-reader admins) the spec went out of its way to design for. Score has to take a real hit when a locked accessibility contract is missed.

---

## Files Audited

**Phase 12 source surfaces:**
- `src/components/suggestions/SearchBar.tsx` — UIDN-03 D-15
- `src/components/suggestions/form/SuggestionForm.tsx` — VIS-06 + UIDN-03 D-14
- `src/components/suggestions/form/DropZone.tsx` (new) — UIDN-03 D-13
- `src/components/suggestions/form/ImageInput.tsx` — UIDN-03 D-13 consumer
- `src/components/admin/AdminSuggestionRow.tsx` — VIS-07
- `src/components/admin/AdminSuggestionsTab.tsx` — VIS-07 caller + optimistic Set
- `src/components/admin/SuggestionKebabMenu.tsx` — cluster sibling, layout audit
- `src/components/suggestions/SuggestionCard.tsx` — VIS-08
- `src/components/suggestions/SuggestionList.tsx` — `useVoteCounts` consumer
- `src/components/ui/checkbox.tsx` (new) — shadcn primitive
- `src/components/ui/switch.tsx` (new) — shadcn primitive
- `src/components/ui/alert.tsx` — VIS-08 variant tokens
- `src/hooks/useToggleResultsVisibility.ts` (new) — admin mutation hook
- `src/index.css` — token canon
- `components.json` — `new-york` + `neutral` confirmation

**Phase 12 contract files:**
- `.planning/phases/12-admin-ui-user-ui-uidn-03-sweep/12-UI-SPEC.md`
- `.planning/phases/12-admin-ui-user-ui-uidn-03-sweep/12-CONTEXT.md`
- All 7 SUMMARY.md files
- `.planning/DESIGN-SYSTEM.md`

**Verification gates re-run during audit:**
- `npm run lint` — clean
- `npx tsc -b` — clean

---

## Recommendation Count

- Priority fixes: **3** (1 BLOCKER, 2 WARNING)
- Minor observations:
  - DropZone uses `px-4 py-8` instead of spec prose `p-8` (acceptable; spec was descriptive)
  - Hidden file input uses `className="hidden"` not `sr-only` (acceptable; Browse Button is the canonical entry)
  - Edit-mode VIS-06 Checkbox replaced with read-only Eye/EyeOff status row (strict-improvement deviation; documented in 12-02-SUMMARY)

---

## Note for orchestrator

- Lint passes; typecheck passes; 393/393 unit tests pass per Wave 2 baseline; TEST-13 Playwright spec is wired and lint-clean (runtime gated by env var per 12-06-SUMMARY).
- The single BLOCKER is a one-line accessibility-contract fix; everything else is polish or observation.
- No registry safety findings — Phase 12's two new primitives (`Checkbox`, `Switch`) are official shadcn (per `12-00-SUMMARY.md` and confirmed by `components.json`); no third-party registries declared.
