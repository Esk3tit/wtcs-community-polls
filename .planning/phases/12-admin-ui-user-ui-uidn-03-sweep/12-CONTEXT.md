# Phase 12: Admin UI + User UI + UIDN-03 Sweep - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Visible surfaces for SEED-002 admin-controlled results visibility plus the deferred v1.1 Path-3 native-button cleanup co-landing in the same touched files. Phase 11 shipped the database + Edge Function foundation (`results_hidden` column, `vote_counts` RLS, `toggle-results-visibility` EF, `polls_effective` projection); Phase 12 wires those into the React client.

**In scope (Phase 12 boundary):**
- **Admin UI (VIS-06):** "Hide results from voters" checkbox on `SuggestionForm` — vendored shadcn `Checkbox` primitive (`npx shadcn@latest add checkbox`).
- **Admin UI (VIS-07):** Inline shadcn `Switch` on `AdminSuggestionRow` (Phase 11 user-picked over locked-VIS-07 Button) — vendored via `npx shadcn@latest add switch`. Calls `toggle-results-visibility` EF. **REQUIREMENTS.md VIS-07 wording edit lands in Phase 12:** strip the "AlertDialog confirmation + audit-trail note" prose; replace with "optimistic Switch + sonner toast + revert on error" pattern.
- **User UI (VIS-08):** `SuggestionCard` renders a hidden-state Alert ("Results temporarily hidden by admin") in place of `<ResultBars>` when the voter has voted AND `results_hidden = true`. Voter's own choice is still surfaced as a "Your response: {label}" line above the Alert. Archive view inherits this (same `SuggestionCard`).
- **Read-path extension:** `useVoteCounts` extended to also fetch `results_hidden` from `polls_effective` at the existing 8s polling cadence, so voter UI auto-updates within ~8s of an admin flip without a page reload.
- **UIDN-03 sweep (4 native-button sites):**
  - `SearchBar.tsx:22` → `<Button variant="ghost" size="icon">` with X icon.
  - `SuggestionForm.tsx:140 + :163` → TanStack `<Link to='/admin'>` (declarative navigation; preserves middle-click / cmd-click).
  - `ImageInput.tsx:108` → extract a new `<DropZone>` component (outer div = drag handlers + dashed border + state styles; inner shadcn `<Button variant="outline" size="sm">` reading "Browse files" = keyboard entry point).
- **Type regen:** Run `supabase gen types typescript --linked > src/lib/types/database.types.ts`. Commit the regen. Add `npm run gen:types` for repeatability.
- **TEST-13 (Playwright E2E):** Single happy-path spec walking the locked SC4 end-to-end (admin creates → voter votes → admin hides → voter UI shows Alert → admin shows → voter UI shows count bars). Uses Phase 8 `freshPoll` fixture extended with a vote-cast step. `[E2E]`-scoped locators per ESLint E2E-SCOPE-1.
- **REQUIREMENTS.md edits:** VIS-07 wording (Button + AlertDialog → Switch + toast). Mark VIS-06, VIS-07, VIS-08, UIDN-03, TEST-13 complete in the traceability table once landed.

**Out of scope (Phase 13+ or v1.3+):**
- **UIDN-02 mobile audit closure** — Phase 13 owns; the Lighthouse rerun depends on Phase 12's prod deploy to stabilize perf budget.
- **UIDN-03-FOLLOWUP-LIST-CARDS** — AdminsList / CategoriesList / PromoteAdminDialog hand-rolled list containers → `<Card>` wrappers. Already-deferred to v1.3 per REQUIREMENTS Future Requirements; Phase 12 stays tight.
- **Admin audit-log UI** — surfacing `audit_log` rows in the admin dashboard (deferred to v1.3+ per Phase 11 deferred list; reaffirmed by Phase 12 A1-D4).
- **Tooltip primitive vendor** (no shadcn `Tooltip` needed; A1-D4 chose silent audit-log treatment).
- **Audit-log retention policy / pruning** — out of v1.2 (Phase 11 deferred).
- **CI drift gate** for `database.types.ts` — deferred to a future hygiene phase.
- **Phase 12 will NOT** introduce new Edge Functions, migrate the DB, or change RLS (Phase 11 owns those).

</domain>

<decisions>
## Implementation Decisions

### Switch confirmation UX (Area 1)
- **D-01:** **AlertDialog dropped.** Switch flips optimistically on click. EF call runs in background. Sonner toast confirms; revert + error toast on failure. Matches `usePinPoll` precedent. **REQUIREMENTS.md VIS-07 wording edit lands in Phase 12** to strip the "AlertDialog confirmation with suggestion title + audit-trail note before confirming" prose and replace with the optimistic+toast pattern.
- **D-02:** **In-flight state:** Switch flips immediately but is **disabled + shows a small `<Loader2 className="animate-spin">` adjacent** until the EF returns. Re-enabled on response. Prevents rapid-double-click no-op noise in `audit_log`. Matches the `submitting` state pattern in `SuggestionForm.tsx`.
- **D-03:** **Toast copy = symmetric state.** `'Results hidden for: {title}'` on hide. `'Results visible for: {title}'` on show. Matches the existing Pin/Unpin/Close toast conventions surfaced by admin mutation hooks.
- **D-04:** **Audit-log surface = silent.** No UI hint (no tooltip on Switch, no toast suffix). `audit_log` is a backend forensics surface in v1.2; the admin audit-log UI is explicitly deferred to v1.3+. Avoids needing to vendor `Tooltip` primitive just for this hint.

### Admin Switch placement (Area 2)
- **D-05:** **Inline Switch on `AdminSuggestionRow` right side**, between the response-count text and the `SuggestionKebabMenu`. Always-visible state indicator across the whole admin list (admin reads current visibility at a glance). NOT placed inside the kebab menu.
- **D-06:** **Label = action-form, two-state.** `'Hide results'` when currently visible. `'Show results'` when currently hidden. Switch position mirrors current state (on = visible). Matches the locked-VIS-07 phrasing of "Hide results / Show results toggle button."
- **D-07:** **Mobile layout — Switch + lucide `Eye`/`EyeOff` icon on sub-`sm`; Switch + full action label on `sm+`.** Tailwind `hidden sm:inline` pattern. Mirrors the Navbar's mobile-first treatment. Keeps state visible everywhere without crowding the 320-375px row.
- **D-08:** **Switch renders identically regardless of resolution state.** Even when the amber "Needs resolution" flag is showing on a closed-with-null-resolution poll, the Switch coexists. VIS-02 explicitly locks any-lifecycle-flip; the two concerns are orthogonal.

### Hidden-state user message (Area 3)
- **D-09:** **Hidden state = shadcn `<Alert>` block with `EyeOff` lucide icon + locked copy `'Results temporarily hidden by admin'`.** `<Alert>` is already vendored at `src/components/ui/alert.tsx` (used in `SuggestionForm`'s error state). Renders in the same vertical slot as `<ResultBars>` / `<ChoiceButtons>`.
- **D-10:** **Voter's own choice surfaced as a `'Your response: {label}'` line above the Alert.** Preserves personal recall (especially on long polls or after days). No vote-count data leaks. Matches RSLT-01's spirit (results gated; voter identity is theirs).
- **D-11:** **Read path: extend `useVoteCounts` to also re-fetch `results_hidden` from `polls_effective` at the same 8s polling cadence.** Hook signature grows to return `{ voteCounts, resultsHidden: Map<pollId, boolean>, refetch }` (planner picks exact return shape). Within ~8s of an admin flip, the voter UI reflects the change without a page reload. One extra small SELECT per poll cycle (free-tier safe at 20-30 concurrent users).
- **D-12:** **Locked copy is uniform across live and archived polls.** `'Results temporarily hidden by admin'` on both. VIS-08 unchanged. ("Temporarily" stays accurate per VIS-02 — admin can unhide an archived poll at any time.)

### ImageInput drop-zone disposition / UIDN-03 sweep (Area 4)
- **D-13:** **Extract a new `<DropZone>` component.** Outer div carries `onDragEnter/Over/Leave/Drop` + the `border-dashed` styling + dynamic `bg-muted/60` / `ring-2 ring-ring` state. Inner shadcn `<Button variant="outline" size="sm">` reads `'Browse files'` and is the keyboard-activatable Browse trigger. Uploading state hides the Button and shows `Loader2` + `'Uploading…'`. Empty/idle state shows `ImagePlus` icon + `'Drop an image here'` headline + `'JPG, PNG, or WebP · max 2 MB'` subtext + the inner Button. Resolves UIDN-03 audit footnote [c] for `ImageInput.tsx:108`.
- **D-14:** **SuggestionForm.tsx:140 + :163 → TanStack `<Link to='/admin'>`.** Replace both imperative `<button onClick={() => navigate(...)}>` with declarative `<Link>` wrapping the existing inline-flex span + `ChevronLeft` icon + `'Back to admin'` text. Preserves browser-native middle-click / cmd-click / right-click semantics. Resolves UIDN-03 audit footnote [c].
- **D-15:** **SearchBar.tsx:22 → `<Button variant="ghost" size="icon">` with `X` icon.** Preserve `type='button'`, `onClick={() => onChange('')}`, `aria-label='Clear search'`. Planner tunes sizing classes (`size-8` vs default `size-9`) against the `h-10` Input. Resolves UIDN-03 audit footnote [b].

### TEST-13 E2E scope (Area 5)
- **D-16:** **Single happy-path spec.** One Playwright `.spec.ts` walks the locked ROADMAP SC4 top-to-bottom: admin logs in → creates poll (checkbox unchecked) → a voter casts a vote (Phase 8 `freshPoll` fixture extended with a vote-cast step) → admin hides via Switch → voter UI shows Alert within ~8s → admin shows via Switch → voter UI shows count bars. `[E2E]`-scoped locators per ESLint E2E-SCOPE-1. Runs against the same Supabase target as existing `@smoke` specs.

### VIS-06 checkbox placement + copy (Area 6)
- **D-17:** **Checkbox sits below `CategoryPicker`, own vertical row.** `<Checkbox>` + `<Label>` reading `'Hide results from voters'` (REQUIREMENTS-verbatim) + a small `text-xs text-muted-foreground` helper underneath: `'Voters with responses will see a placeholder instead of counts. Toggle anytime from the admin list.'`. Default unchecked. Vendor shadcn primitive via `npx shadcn@latest add checkbox`.

### Type regeneration (Area 7)
- **D-18:** **Regen `database.types.ts` via `supabase gen types typescript --linked > src/lib/types/database.types.ts`.** Commit the regen. Add `npm run gen:types` script for repeatability. CI drift gate deferred to a future hygiene phase (v1.2 scope stays tight).

### UIDN-03-FOLLOWUP-LIST-CARDS scope (Area 8)
- **D-19:** **Stay deferred to v1.3.** AdminsList / CategoriesList / PromoteAdminDialog hand-rolled `divide-y border rounded-md` list containers are not folded into Phase 12. REQUIREMENTS already records the deferral. Phase 12 stays tight to the locked UIDN-03 four-site sweep.

### Claude's Discretion
- **shadcn primitive vendor commands** — exact `npx shadcn@latest add checkbox switch` invocation order; new files land under `src/components/ui/{checkbox,switch}.tsx` per established convention.
- **Exact return shape of extended `useVoteCounts`** — D-11 locks the columns needed; planner picks `Map<pollId, boolean>` vs merged object vs companion `Set<pollId>` based on call-site ergonomics in `SuggestionCard`.
- **`<DropZone>` file location** — likely `src/components/suggestions/form/DropZone.tsx` (colocated with `ImageInput.tsx`) but planner verifies file-organization fit.
- **Sizing classes for the SearchBar clear-X** — planner tunes against the `h-10` Input height; `size-8` is the leading candidate.
- **`toggle-results-visibility` hook** — new `useToggleResultsVisibility.ts` matching the `usePinPoll` shape (Promise-returning `mutate` + status). Planner names + matches existing hook idioms.
- **TEST-13 fixture extension** — exact API of the `freshPoll`-with-vote helper (one fixture vs two) is planner's call.
- **TanStack `<Link>` search params** — current `navigate({ to: '/admin' })` doesn't carry `?tab=suggestions`; planner verifies whether the Link should add `search={{tab:'suggestions'}}` for consistency.
- **Mobile breakpoint exact value** — `sm` (≥640px) is the leading candidate per D-07, but planner can pick `md` if the row crowding starts earlier.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements (locked)
- `.planning/REQUIREMENTS.md` § "Admin Visibility Controls (SEED-002 reframed)" — **VIS-06, VIS-07, VIS-08 are locked**; **VIS-07 carries a wording edit in Phase 12** (Button + AlertDialog → Switch + toast per D-01).
- `.planning/REQUIREMENTS.md` § "UI Polish Closure (carry-forward from v1.1 Path-3)" — **UIDN-03** four-site sweep (locked sites: `SearchBar.tsx:22`, `SuggestionForm.tsx:140` + `:163`, `ImageInput.tsx:108`); UIDN-03-FOLLOWUP-LIST-CARDS explicitly deferred to v1.3 (D-19).
- `.planning/REQUIREMENTS.md` § "Testing & Validation" — **TEST-13** Playwright E2E happy-path spec.
- `.planning/REQUIREMENTS.md` § "Future Requirements" — `UIDN-03-FOLLOWUP-LIST-CARDS` deferred to v1.3 (reaffirmed by D-19); Admin audit-log UI deferred to v1.3+ (reaffirmed by D-04).
- `.planning/ROADMAP.md` § "Phase 12: Admin UI + User UI + UIDN-03 Sweep" — **5 success criteria locked.**

### Prior phase context (carry-forward)
- `.planning/phases/11-schema-rls-ef-foundations/11-CONTEXT.md` — Phase 11 specifics: **Switch over Button** (user pivot), **D-11/D-12 EF idempotency contract** (race-safe conditional UPDATE, returns 200 with full poll row on no-op), **D-13 EF-direct timestamp write**, **D-19 `polls-effective-invariant.test.ts` continues to pass** (no new direct `from('polls')` reads).
- `.planning/PROJECT.md` § Constraints — $0/mo budget; Supabase free tier (extended `useVoteCounts` polls add small SELECT per cycle — verify free-tier safe).
- `.planning/PROJECT.md` § Key Decisions — `shadcn/ui new-york + Tailwind CSS v4` ⚠️ Revisit row flips ✓ Good once UIDN-03 four-site sweep lands (Phase 12 closure evidence to be captured in Phase 13 closure step if not folded here).

### Closure audit (UIDN-03 disposition rationale)
- `.planning/closure/UIDN-03-shadcn-audit.md` § "Drift findings + fixes" footnote [b] — SearchBar.tsx:22 clear-X native button drift (D-15).
- `.planning/closure/UIDN-03-shadcn-audit.md` § footnote [c] — SuggestionForm.tsx:140 + :163 + ImageInput.tsx:108 native button drift (D-13, D-14).
- `.planning/closure/UIDN-03-shadcn-audit.md` § footnote [e] — AdminsList / CategoriesList / PromoteAdminDialog list containers (DEFERRED per D-19).

### Source surfaces touched by Phase 12
- `src/components/admin/AdminSuggestionRow.tsx` — inline Switch placement target (D-05/D-06/D-07).
- `src/components/admin/AdminSuggestionsTab.tsx` — already supports `filter=active|closed|all`; **single admin surface covers both "live + archived" admin cards** per ROADMAP SC2 (no new admin-archive route needed).
- `src/components/admin/SuggestionKebabMenu.tsx` — NOT touched for the Switch (D-05 chose inline placement, not kebab); reference for consistency only.
- `src/components/suggestions/SuggestionCard.tsx` — hidden-state Alert integration (D-09/D-10); branch added between current `userChoiceId ? <ResultBars> : <ChoiceButtons>` ternary.
- `src/components/suggestions/ResultBars.tsx` — reference for understanding the slot the Alert replaces (no changes expected).
- `src/components/suggestions/form/SuggestionForm.tsx` — VIS-06 checkbox insertion (D-17), UIDN-03 lines 140 + 163 native-button replacement (D-14).
- `src/components/suggestions/form/ImageInput.tsx` — extract `<DropZone>` component (D-13).
- `src/components/suggestions/SearchBar.tsx` — line 22 native-button replacement (D-15).
- `src/hooks/useVoteCounts.ts` — extend with `results_hidden` fetch + return-shape grow (D-11).
- `src/hooks/useSuggestions.ts` — already SELECTs * from `polls_effective`; **`results_hidden` flows through automatically once types regen**.
- `src/hooks/usePinPoll.ts` — precedent for the new `useToggleResultsVisibility` hook (optimistic + toast + revert pattern).
- `src/lib/types/database.types.ts` — **STALE**; regen via `supabase gen types typescript --linked` (D-18).
- `src/lib/types/suggestions.ts` — `SuggestionWithChoices` derives from `Tables<'polls'>`; will inherit `results_hidden` + `results_hidden_changed_at` once types regen.
- `src/components/ui/alert.tsx` — already vendored; used by D-09 hidden-state message.
- `src/components/ui/button.tsx` — already vendored; consumed by D-13/D-14/D-15.
- `src/components/ui/checkbox.tsx` — **DOES NOT EXIST**; vendor via `npx shadcn@latest add checkbox` (D-17).
- `src/components/ui/switch.tsx` — **DOES NOT EXIST**; vendor via `npx shadcn@latest add switch` (D-05).

### Edge Function consumed (Phase 11 deliverable)
- `supabase/functions/toggle-results-visibility/index.ts` — admin-gated, idempotent, race-safe; consumed by `useToggleResultsVisibility` hook. **Phase 12 does not modify this EF.**
- `supabase/functions/create-poll/index.ts` — already accepts optional `results_hidden?: boolean` (Phase 11 D-08); `useCreatePoll` passes the VIS-06 checkbox value through.

### TEST-13 fixtures and helpers
- `e2e/fixtures/freshPoll.ts` — Phase 8 `freshPoll` fixture; **extend with a vote-cast step** for TEST-13 (D-16).
- `e2e/helpers/auth.ts` — Playwright `loginAs` helper for admin + voter sessions in TEST-13.
- `e2e/integration/toggle-results-visibility.test.ts` — Phase 11 EF authz test; **reference only — TEST-13 is a different layer** (browser-driven Playwright vs Vitest integration).

### Codebase patterns to mirror
- `src/__tests__/admin/polls-effective-invariant.test.ts` — invariant pattern: continues to pass with zero new `from('polls')` direct reads in `src/` after Phase 12 lands (per VIS-09 / Phase 11 D-19).
- Project source-comment policy — **WHY-only, no review-round / phase-ID archaeology in `src/`**. Plan refs belong in PR/commit, not `src/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`<Alert>` primitive** (`src/components/ui/alert.tsx`) — already vendored; consumed by D-09 hidden-state message. Variant default + EyeOff icon + locked copy.
- **`<Button>` primitive** (`src/components/ui/button.tsx`) — used by D-13/D-14/D-15. Variants needed: `ghost size=icon` (SearchBar X), `outline size=sm` (DropZone Browse).
- **`usePinPoll` hook** (`src/hooks/usePinPoll.ts`) — precedent for the new `useToggleResultsVisibility` hook (optimistic + toast + revert; matches D-01 contract).
- **Phase 8 `freshPoll` fixture** — TEST-13 extends this with a vote-cast step rather than building from scratch.
- **`useSuggestions` already reads from `polls_effective`** — `SELECT *` will pick up `results_hidden` + `results_hidden_changed_at` automatically once `database.types.ts` is regenerated. No read-path rewrite needed for the initial page-load state.
- **`usePolling` hook** (`src/hooks/usePolling.ts`) — already drives the 8s `useVoteCounts` cadence; the D-11 extension reuses this same polling mechanism.
- **Toggle-results-visibility EF** (Phase 11 shipped) — idempotent + race-safe + returns full poll row on every code path (D-11/D-12 from Phase 11). The hook can trust the response shape.

### Established Patterns
- **Admin mutation hook pattern** — anon-key client for `auth.getUser()`, then `supabase.functions.invoke` with `body`. Returns `{ ok: true, data } | { ok: false, error }`. New `useToggleResultsVisibility` follows this verbatim.
- **Sonner toast precedent** — admin success/failure toasts use sonner via existing admin hooks (`usePinPoll`, `useClosePoll`, `useSetResolution`). D-03 toast copy plugs into the same.
- **Optimistic + reconcile pattern** — `AdminSuggestionsTab.handleTogglePin` shows the canonical shape: optimistic local mutation → fire EF → revert on error / refetch on success. The new Switch handler mirrors this exactly.
- **`polls_effective` invariant** — `src/__tests__/admin/polls-effective-invariant.test.ts` blocks merge if any new direct `from('polls')` reads land in `src/`. Phase 12 must NOT add any.
- **Form vertical-section rhythm** in `SuggestionForm.tsx` — each field is `<div className="space-y-2">` with Label + control. D-17 checkbox follows this rhythm.

### Integration Points
- **EF call site:** new `useToggleResultsVisibility` calls `supabase.functions.invoke('toggle-results-visibility', { body: { poll_id, hidden } })`. Wired into `AdminSuggestionRow` via a callback prop (matching the `onTogglePin` shape `AdminSuggestionsTab` uses today).
- **`useCreatePoll` extension:** passes `results_hidden?: boolean` from the VIS-06 checkbox through to the EF body. Phase 11's create-poll EF (D-08) already accepts the field.
- **TanStack Router `<Link>` wiring:** the D-14 sites need `import { Link } from '@tanstack/react-router'`. Search-param behavior (`?tab=suggestions`) is Claude's discretion per D-decisions; not required by ROADMAP.
- **Mobile breakpoint Tailwind:** D-07 uses `sm:` (≥640px) — matches the existing mobile-first pattern. `hidden sm:inline` for the action-form label.

</code_context>

<specifics>
## Specific Ideas

- **User-chosen Switch over Button** (carried forward from Phase 11 specifics) — REQUIREMENTS VIS-07 wording edit lands in Phase 12 to reflect this.
- **User-chosen optimistic + toast pattern over AlertDialog confirmation** (A1-D1) — direct override of the locked-VIS-07 AlertDialog prose; the wording edit makes this canonical.
- **User-chosen inline Switch placement over kebab-menu placement** (A2-D5) — admin reads visibility state at a glance across the whole admin list.
- **User-chosen action-form Switch label "Hide results" / "Show results"** (A2-D6) — matches locked-VIS-07 verbiage.
- **User-chosen DropZone refactor over keep-native+WHY-comment** (A4-D13) — bigger refactor than the minimum, produces clean single-purpose semantics (drag target vs Browse trigger).
- **User-chosen TanStack `<Link>` over `<Button variant="link">`** (A4-D14) — preserves browser-native navigation semantics.
- **User-chosen single happy-path TEST-13 spec over split** (A5-D16) — keeps the locked SC4 testable end-to-end as one walk.
- **User-chosen checkbox copy verbatim per REQUIREMENTS** (A6-D17) — `'Hide results from voters'` + small helper text below.
- **User-chosen regen + npm script over hand-augment** (A7-D18) — drift gate deferred but `npm run gen:types` makes future regens cheap.
- **User-chosen strict-deferral of UIDN-03-FOLLOWUP-LIST-CARDS** (A8-D19) — Phase 12 stays tight.

</specifics>

<deferred>
## Deferred Ideas

- **v1.3+ admin audit-log UI** — surface `audit_log` rows in the admin dashboard (filter by actor, action, target). Already noted in REQUIREMENTS.md Future Requirements; reaffirmed by D-04 (silent treatment in v1.2).
- **UIDN-03-FOLLOWUP-LIST-CARDS (v1.3)** — AdminsList / CategoriesList / PromoteAdminDialog hand-rolled list containers → `<Card>` wrappers (3 files, 4 sites per UIDN-03 audit footnote [e]). Reaffirmed by D-19.
- **CI drift gate for `database.types.ts`** — automatic detection that `gen:types` is in sync with prod. Deferred to a future hygiene phase per D-18.
- **shadcn `Tooltip` primitive vendor** — not needed in Phase 12 (D-04 chose silent audit-log treatment).
- **`audit_log` retention policy** — automatic pruning. Reaffirmed deferred (was already deferred in Phase 11).
- **TanStack `<Link>` with `?tab=suggestions` search param** — Claude's discretion in D-14; if planner picks "don't carry the param," it lands as a follow-up if admins report missing-context behavior.
- **`Tooltip` on the inline Switch** for screen-reader supplementary context — out of A1-D4; revisit if a11y feedback surfaces.
- **Adaptive copy for closed polls** ("Results hidden by admin" without "temporarily" on closed) — A3-D12 chose uniform locked copy; revisit if user feedback flags the wording.

</deferred>

---

*Phase: 12-admin-ui-user-ui-uidn-03-sweep*
*Context gathered: 2026-05-12*
