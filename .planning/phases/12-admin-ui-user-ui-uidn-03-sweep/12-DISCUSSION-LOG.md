# Phase 12: Admin UI + User UI + UIDN-03 Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 12-admin-ui-user-ui-uidn-03-sweep
**Areas discussed:** Switch confirmation UX; Admin Switch placement; Hidden-state user message; ImageInput drop-zone disposition; TEST-13 E2E scope shape; VIS-06 checkbox placement + copy; Type regeneration + drift gate; UIDN-03-FOLLOWUP-LIST-CARDS scope

---

## Switch confirmation UX

### Q1 — Confirmation shape

| Option | Description | Selected |
|--------|-------------|----------|
| AlertDialog modal (keep) | Switch click → AlertDialog → Confirm/Cancel. Matches locked-VIS-07. | |
| Immediate flip + toast | Optimistic Switch + sonner toast + revert on error. Matches `usePinPoll`. | ✓ |
| Immediate flip + undo toast | Optimistic + 5s Undo button in toast. Two audit rows per change-of-mind. | |
| You decide | Pick by consistency with existing destructive actions vs Pin precedent. | |

**User's choice:** Immediate flip + toast (Recommended).
**Notes:** AlertDialog dropped. REQUIREMENTS.md VIS-07 wording edit lands in Phase 12 to strip "AlertDialog + audit-trail note" prose.

### Q2 — In-flight state

| Option | Description | Selected |
|--------|-------------|----------|
| Switch disabled + small spinner | Visual flip + Loader2 + disabled until EF returns. | ✓ |
| Fully optimistic, no disabled state | Immediately interactive. Tolerates double-click noop noise. | |
| Switch unchanged until EF success | Position flips only after 200 returns. | |

**User's choice:** Switch disabled + small spinner (Recommended).
**Notes:** Prevents rapid-double-click no-op noise in audit_log. Matches `submitting` state in `SuggestionForm.tsx`.

### Q3 — Toast copy

| Option | Description | Selected |
|--------|-------------|----------|
| Symmetric state copy | 'Results hidden for: {title}' / 'Results visible for: {title}'. | ✓ |
| Action-verb copy | 'Hid results for {title}' / 'Showed results for {title}'. | |
| Stateful-with-audit copy | Lengthier; explicitly tells admin what voters now see. | |

**User's choice:** Symmetric state copy (Recommended).
**Notes:** Matches existing Pin/Unpin/Close toast conventions.

### Q4 — Audit-log visibility hint

| Option | Description | Selected |
|--------|-------------|----------|
| Silent | No UI surface. audit_log is backend-only in v1.2. | ✓ |
| Tooltip on the Switch | Hover/long-press tooltip. Requires shadcn `Tooltip` primitive. | |
| Toast suffix | Append ' · logged' to success toast. | |

**User's choice:** Silent (Recommended).
**Notes:** Avoids vendoring Tooltip just for this hint. Admin audit-log UI deferred to v1.3+.

---

## Admin Switch placement

### Q1 — Switch home

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on the row, right side | Visible Switch + label between voteCount and kebab. Always-visible state. | ✓ |
| Inside SuggestionKebabMenu | DropdownMenuItem next to Pin/Unpin. Two taps. | |
| Both — inline + kebab item | Redundant; most discoverable. | |
| Small status pill on row + Switch in kebab | New 'Hidden' badge near Active/Closed; toggle in kebab. | |

**User's choice:** Inline on the row, right side (Recommended).
**Notes:** Always-visible state indicator across the whole admin list.

### Q2 — Switch label

| Option | Description | Selected |
|--------|-------------|----------|
| Action-form label | 'Hide results' / 'Show results' — describes the click action. | ✓ |
| State-form label | 'Results visible' / 'Results hidden' — describes current state. | |
| Icon only (Eye / EyeOff) | Compact; aria-label for screen readers. | |
| Static label + Switch | 'Results' + Switch; state read entirely from Switch position. | |

**User's choice:** Action-form label (Recommended).
**Notes:** Matches locked-VIS-07 "Hide results / Show results toggle button" phrasing.

### Q3 — Mobile layout

| Option | Description | Selected |
|--------|-------------|----------|
| Switch + icon-only on mobile, label on ≥sm | Tailwind `hidden sm:inline` pattern. | ✓ |
| Always show label | Row grows taller on mobile; wraps to 2-line. | |
| Move Switch into kebab on mobile, inline on ≥sm | Two render paths; loses at-a-glance on mobile. | |

**User's choice:** Switch + icon-only on mobile, label on ≥sm (Recommended).
**Notes:** Mirrors Navbar mobile-first treatment.

### Q4 — Switch on closed-with-null-resolution polls

| Option | Description | Selected |
|--------|-------------|----------|
| Always show Switch | VIS-02 locked any-lifecycle flip; orthogonal to resolution state. | ✓ |
| Hide Switch when amber | Force admin to clear amber first. Paternalistic; not required. | |
| Show Switch but de-emphasized when amber | `opacity-60` soft hint. | |

**User's choice:** Always show Switch (Recommended).
**Notes:** VIS-02 explicitly locks any-lifecycle flip.

---

## Hidden-state user message

### Q1 — Hidden-state shell

| Option | Description | Selected |
|--------|-------------|----------|
| Styled `<Alert>` with EyeOff icon | shadcn `<Alert>` (already vendored) + lucide EyeOff + locked copy. | ✓ |
| Plain text in muted-foreground | Single line; could read as "nothing here". | |
| Empty-state pattern | Heavier visual block. | |
| Custom small card (new component) | New `<HiddenResultsMessage>` component. | |

**User's choice:** Styled `<Alert>` with EyeOff icon (Recommended).
**Notes:** Reuses already-vendored `<Alert>` primitive.

### Q2 — Voter's own choice rendering

| Option | Description | Selected |
|--------|-------------|----------|
| 'Your response: {label}' above the Alert | Preserves personal recall; no counts leak. | ✓ |
| Alert only — fully replace | Voter cannot see their choice from the card. | |
| ChoiceButtons disabled-but-highlighted + Alert below | Visually richest; risk of re-click attempts. | |

**User's choice:** Show 'Your response: {label}' above the Alert (Recommended).
**Notes:** Matches RSLT-01 spirit (results gated; voter identity is theirs).

### Q3 — Refresh cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-refresh within ~8s, same cadence as counts | Extend `useVoteCounts` to also fetch `results_hidden`. | ✓ |
| Only on next page load / refetch | No extra queries; voters who linger don't see flip take effect. | |
| Smart — infer from non-zero → zero count flip | Brittle; conflicts with genuinely 0-vote polls. | |

**User's choice:** Auto-refresh within ~8s, same cadence as counts (Recommended).
**Notes:** Extends `useVoteCounts` to re-fetch `results_hidden` from `polls_effective`. Free-tier safe at 20-30 concurrent users.

### Q4 — Closed-poll copy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep locked copy uniform | 'Results temporarily hidden by admin' on live + closed. | ✓ |
| Adapt copy for closed polls | Drop 'temporarily' on closed. | |
| Different copy plus contextual hint | Add ResolutionBadge to Alert on closed. | |

**User's choice:** Keep locked copy uniform (Recommended).
**Notes:** VIS-02 keeps "temporarily" technically accurate.

---

## ImageInput drop-zone disposition

### Q1 — DropZone refactor approach

| Option | Description | Selected |
|--------|-------------|----------|
| Keep native + WHY-comment | Native button stays; explanatory comment per LR-07 style. | |
| Convert with `<Button asChild>` wrapping a `<div>` | Slottable Button with drag handlers. Style clash risk. | |
| Extract `<DropZone>` component + inner `<Button>` | Outer div = drag target; inner Button = Browse trigger. | ✓ |

**User's choice:** Extract `<DropZone>` component + inner `<Button>` as Browse trigger.
**Notes:** Bigger refactor than minimum; clean single-purpose semantics.

### Q2 — DropZone inner Button shape

| Option | Description | Selected |
|--------|-------------|----------|
| Outer div: drag handlers + dashed border. Inner Button: variant='outline' size='sm' 'Browse files' | Inner Button is keyboard entry point. | ✓ |
| Inner Button: variant='ghost' (subtle) | Ghost button on colored background near-invisible risk. | |
| Inner Button: variant='default' (primary CTA) | Competes with dropzone visual. | |

**User's choice:** Outer div: drag handlers + dashed border. Inner Button: variant='outline' size='sm' 'Browse files' (Recommended).
**Notes:** Uploading state hides the Button + shows Loader2 + 'Uploading…'.

### Q3 — Back-to-admin native button fix

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack `<Link to='/admin'>` with link styling | Declarative URL; preserves middle-click / cmd-click. | ✓ |
| shadcn `<Button variant='link'>` | Keeps imperative navigate; loses middle-click. | |
| shadcn `<Button variant='ghost' size='sm'>` | Subtle ghost-button styling. | |
| Replace with TanStack `<Link>` AND extract `<BackToAdminLink>` component | DRY; fourth file touched. | |

**User's choice:** TanStack `<Link to='/admin'>` with link styling (Recommended).
**Notes:** Both line 140 (error state) and line 163 (regular form) use the same Link pattern.

### Q4 — SearchBar clear-X

| Option | Description | Selected |
|--------|-------------|----------|
| `<Button variant='ghost' size='icon'>` with X icon | Straight replacement; preserve aria-label. | ✓ |
| `<Button variant='ghost' size='sm'>` | If absolute positioning math is fiddly with size='icon'. | |
| Keep className overrides minimal | Inherit Button defaults if Input pr-9 fits. | |

**User's choice:** `<Button variant='ghost' size='icon'>` with X icon (Recommended).
**Notes:** Planner tunes sizing classes against `h-10` Input.

---

## TEST-13 E2E scope shape

### Q1 — Spec shape and target

| Option | Description | Selected |
|--------|-------------|----------|
| Single happy-path spec, local + prod | One spec walks the locked SC4 end-to-end. Uses Phase 8 `freshPoll`. | ✓ |
| Two specs: create-with-hidden + toggle-flow | More granular failure-mode isolation. | |
| Single spec WITHOUT vote-cast (RLS shortcut) | Seed vote via service-role; skips UI flow. | |

**User's choice:** Single happy-path spec, local + prod (Recommended).
**Notes:** ESLint E2E-SCOPE-1 compliant via `[E2E]`-scoped locators. `freshPoll` fixture extended with vote-cast step.

---

## VIS-06 checkbox placement + copy

### Q1 — Checkbox layout and copy

| Option | Description | Selected |
|--------|-------------|----------|
| Below CategoryPicker, own row, copy 'Hide results from voters' | REQUIREMENTS-verbatim + small helper text below. | ✓ |
| Inside collapsible 'Advanced' section | Hides by default; discoverability dies. | |
| Adjacent to TimerPicker as side-by-side flex | Risk of reading as "related to timer". | |
| Above choices, next to title | Top-of-form prominence; noise for most admins. | |

**User's choice:** Below CategoryPicker, own row, copy 'Hide results from voters' (Recommended).
**Notes:** Helper text: 'Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list.'

---

## Type regeneration + drift gate

### Q1 — Regen approach

| Option | Description | Selected |
|--------|-------------|----------|
| Regen via supabase CLI + commit + add npm script | `supabase gen types typescript --linked`; CI drift gate deferred. | ✓ |
| Regen + CI drift gate | Adds CI step to fail on drift. Costs CI minutes + secrets. | |
| Hand-augment in suggestions.ts only | Smallest diff; drift grows over time. | |

**User's choice:** Regen via supabase CLI + commit + add npm script (Recommended).
**Notes:** CI drift gate deferred to a future hygiene phase.

---

## UIDN-03-FOLLOWUP-LIST-CARDS scope

### Q1 — Fold or defer

| Option | Description | Selected |
|--------|-------------|----------|
| Stay deferred to v1.3 | REQUIREMENTS explicit deferral; Phase 12 stays tight. | ✓ |
| Fold in (extras, tagged separately) | Replace 4 hand-rolled list containers with `<Card>`. | |
| Fold in only the highest-impact one | AdminsList only; CategoriesList + PromoteAdminDialog deferred. | |

**User's choice:** Stay deferred to v1.3 (Recommended).
**Notes:** Phase 12 stays tight to locked UIDN-03 four-site sweep.

---

## Claude's Discretion

- shadcn primitive vendor commands (`npx shadcn@latest add checkbox switch`); files land under `src/components/ui/`.
- Exact return shape of extended `useVoteCounts` (Map vs merged object vs companion Set).
- `<DropZone>` file location (likely `src/components/suggestions/form/DropZone.tsx`).
- SearchBar clear-X exact sizing classes (`size-8` vs default `size-9`) against the `h-10` Input.
- New `useToggleResultsVisibility` hook naming + matching `usePinPoll` shape.
- TEST-13 fixture extension API (one fixture vs two).
- TanStack `<Link>` `search={{tab:'suggestions'}}` carry-over.
- Mobile breakpoint exact value (`sm` ≥640px is the leading candidate per D-07).

## Deferred Ideas

- v1.3+ admin audit-log UI (reaffirmed by A1-D4).
- UIDN-03-FOLLOWUP-LIST-CARDS (reaffirmed by A8-D19).
- CI drift gate for `database.types.ts` (reaffirmed by A7-D18).
- shadcn `Tooltip` primitive vendor (not needed in Phase 12 per A1-D4).
- `audit_log` retention policy (Phase 11 deferred, reaffirmed).
- TanStack `<Link>` with `?tab=suggestions` search param (Claude's discretion in D-14).
- `Tooltip` on the inline Switch for a11y supplementary context.
- Adaptive copy for closed polls ("Results hidden by admin" without "temporarily") — A3-D12 chose uniform.
