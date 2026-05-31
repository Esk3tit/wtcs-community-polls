# Phase 17: Planning-Doc + UI Hygiene Sweep - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Additive hygiene cleanup across two disjoint workstreams, NIL production risk (no schema, no Edge Function, no migration changes):

1. **Planning-doc hygiene** — VALIDATION.md frontmatter backfill on phase archives 01–04 (DOCS-05), Phase 03 VERIFICATION.md retrospective with a "Subsequent evolution" section naming Migration 14 (DOCS-06), 17 SUMMARY `requirements-completed` declarations backfilled (DOCS-07), and the v1.1 MILESTONES.md entry (DOCS-08, HARD REQ).
2. **UI Card migration** — `AdminsList.tsx` + `CategoriesList.tsx` hand-rolled `<div>` containers → shadcn `<Card>` (UIDN-04); `PromoteAdminDialog.tsx` search-results container → `<Card>` if the audit confirms the original UIDN-03 flag still applies (UIDN-05).

Requirements (DOCS-05/06/07/08, UIDN-04/05) are precisely specified in ROADMAP.md Phase 17 — the WHAT is locked. This discussion captured only HOW-to-implement decisions.

</domain>

<decisions>
## Implementation Decisions

### Card visual treatment (UIDN-04, UIDN-05)
- **D-01:** Adopt **native shadcn Card styling** — `rounded-xl`, `shadow-sm`, the primitive's own borders. Do NOT override Card defaults to chase pixel-parity with the current `border rounded-md` look. Consistency with existing Card consumers (`LandingPage.tsx`, `AuthErrorPage.tsx`) is the goal; larger snapshot diffs are expected and acceptable.
- **D-02:** The section heading ("Admins" / "Categories", currently an external `<h2>`) moves **into `<CardHeader><CardTitle>`**, with the section action `<Button>` (Add admin / Add category) placed in the header row alongside the title. Heading typography shifts to `CardTitle`'s default — accepted.
- **D-03:** Row lists are **full-bleed inside the Card**: use `CardContent` with `p-0` (or `px-0`) so rows span edge-to-edge and `divide-y` lines reach the card borders. Each row keeps its own internal `p-4` / `min-h-[64px]` padding. (Avoids the "box-in-a-box" inset look from `CardContent`'s default `p-6`.)
- **D-04:** One `<Card>` per list section — never one Card per row (over-segmentation anti-pattern, carried forward from Phase 12 UIDN-03). Loading skeleton and empty-state placeholders live inside the same `CardContent`.

### UIDN-05 disposition (PromoteAdminDialog)
- **D-05:** **Audit-gated, biased toward consistency.** Audit the current search-results container first. If the UIDN-03 flag still applies (hand-rolled div), migrate to `Card`/`CardContent` matching D-01–D-04. If the dialog already reads clean, document the no-op with the audit rationale in SUMMARY rather than force-fitting a Card into a modal. **Either outcome MUST verify the Dialog's ARIA roles + `aria-labelledby` survive** (Card primitive is a generic `<div>` — no role conflict expected, but confirm).

### v1.1 MILESTONES.md entry (DOCS-08, HARD REQ)
- **D-06:** **Full structural parity** with the v1.2 MILESTONES entry — reproduce every section (Delivered, Key Accomplishments, Stats, Decimal Phases, Key Decisions with outcomes, Issues Resolved, Known Gaps Carried Forward, Known Tech Debt, Issues Deferred). Omit a section only if genuinely empty, and say so explicitly (e.g. "None for v1.1") rather than dropping it.
- **D-07:** Backfill **retroactive ✓/⚠️ graded outcomes** in the v1.1 "Key Decisions (with outcomes)" table, using hindsight from phases 12–16 (did the UIDN-03 button sweep / E2E locator scoping / etc. hold up?). Source content from `.planning/milestones/v1.1-ROADMAP.md` plus subsequent SUMMARY/VERIFICATION evidence.
- **D-08:** **Manual curation only** — no CLI auto-extraction (lesson from the v1.2 retrospective). The v1.2 entry in `.planning/MILESTONES.md` is the canonical template.

### Plan / commit split
- **D-09:** **Two plans.** Plan A = all doc hygiene (DOCS-05/06/07/08, Markdown-only). Plan B = the UI Card migration (UIDN-04/05, code + snapshot updates). Files are disjoint, so the two can run in parallel. Keep Markdown-only doc commits separate from code+snapshot commits for a cleaner review diff. Planner finalizes wave/commit granularity.

### Cross-cutting (carried forward)
- **D-10:** Source comments in `src/` are WHY-only — no review-round/phase-ID archaeology (no "UIDN-04" / "Phase 17" tags in component code). Plan refs belong in PR/commit, not src/.
- **D-11:** Snapshot tests updated in the **same commit** as the component change; diffs reviewed to confirm they are className/structure changes from the Card migration with no behavioral regression before committing.
- **D-12:** PR merge gate — all configured bots reviewed AND explicit user OK before merge (CI green alone is insufficient).

### Claude's Discretion
- Exact `CardContent` override mechanism for full-bleed rows (`p-0` vs `px-0` + vertical padding tweak) — pick whatever reads cleanest against the live primitive.
- Planner owns wave sequencing and per-task commit boundaries within the two-plan split.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 17: Planning-Doc + UI Hygiene Sweep" — goal, REQ summaries, success criteria (the locked WHAT)
- `.planning/REQUIREMENTS.md` — full DOCS-05, DOCS-06, DOCS-07, DOCS-08, UIDN-04, UIDN-05 definitions and Phase Traceability rows

### Doc hygiene (DOCS-05/06/07/08)
- `.planning/MILESTONES.md` — v1.2 entry is the **canonical template** for the new v1.1 entry (DOCS-08); v1.1 entry is written here
- `.planning/milestones/v1.1-ROADMAP.md` — **source content** for the v1.1 MILESTONES entry (phases 7–10)
- `.planning/RETROSPECTIVE.md` — v1.0 Lesson 1 surfaces DOCS-05 (VALIDATION frontmatter drift); v1.2 retrospective lesson drives DOCS-08 manual-curation rule
- `.planning/milestones/v1.0-phases/01-foundation-authentication/01-VALIDATION.md` — DOCS-05 target (`status: complete`, `nyquist_compliant: true`)
- `.planning/milestones/v1.0-phases/02-browsing-responding/02-VALIDATION.md` — DOCS-05 target
- `.planning/milestones/v1.0-phases/03-response-integrity/03-VALIDATION.md` — DOCS-05 target
- `.planning/milestones/v1.0-phases/04-admin-panel-suggestion-management/04-VALIDATION.md` — DOCS-05 target
- `.planning/milestones/v1.0-phases/03-response-integrity/` — Phase 03 archive dir; DOCS-06 writes a new `03-VERIFICATION.md` here (`status: retrospective`), "Subsequent evolution" lists migrations 3–9 + Migration 14 (DBHY-01) as most recent auth-path change
- `.planning/phases/14-security-definer-search-path-migration/` — Migration 14 evidence referenced by the DOCS-06 "Subsequent evolution" section
- DOCS-07 SUMMARY targets (backfill `requirements-completed`): phases 02, 03-02, 04-02, 04-04, 01-04 SUMMARY frontmatter under `.planning/milestones/v1.0-phases/` — cross-reference against each phase's VERIFICATION.md / archive REQUIREMENTS for REQ-ID coverage

### UI Card migration (UIDN-04/05)
- `src/components/admin/AdminsList.tsx` — UIDN-04 target (current: external `<h2>` + `<div className="divide-y border rounded-md">`)
- `src/components/admin/CategoriesList.tsx` — UIDN-04 target (same pattern)
- `src/components/admin/PromoteAdminDialog.tsx` — UIDN-05 audit target
- `src/components/ui/card.tsx` — shadcn Card primitive (Card / CardHeader / CardTitle / CardContent)
- `src/components/auth/LandingPage.tsx`, `src/components/auth/AuthErrorPage.tsx` — existing Card consumers; reference for the native-Card look (D-01)
- `.planning/milestones/v1.2-phases/12-*/` — Phase 12 UIDN-03 sweep + Card composition pattern (one Card per section, no per-row Cards = D-04 origin)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/card.tsx`: vendored shadcn Card primitive already in the tree — no new dependency. Card (`rounded-xl border shadow-sm`), CardHeader/CardContent (`p-6`), CardTitle.
- `LandingPage.tsx` / `AuthErrorPage.tsx`: live in-repo examples of the native Card look the migration should match (D-01).

### Established Patterns
- Card composition pattern from Phase 12 UIDN-03: one `<Card>` per logical section, rows inside `<CardContent>` with `divide-y` — never wrap each row (D-04).
- Admin lists currently use `<div className="divide-y border rounded-md">` with an external `<h2>` header + action `<Button>` and `p-4 min-h-[64px]` rows; loading state renders skeleton rows, empty state renders a centered placeholder. Migration must preserve these states inside the Card.
- MILESTONES entries are manually curated (no CLI auto-extraction) and graded with ✓/⚠️ outcome verdicts — v1.2 entry is the structural template.

### Integration Points
- Snapshot tests for the admin components must be updated in the same commit as the migration (D-11); diffs reviewed for className/structure-only changes.
- `npm run lint` and `tsc -b` must pass with zero errors post-migration (success criterion 4).
- `PromoteAdminDialog` Card migration sits inside a Dialog — ARIA roles + `aria-labelledby` must survive (D-05).

</code_context>

<specifics>
## Specific Ideas

- Visual target for the Card migration is the existing `LandingPage`/`AuthErrorPage` Card treatment — "make the admin lists look like the rest of the app's cards," not "keep them looking exactly as they do today."
- v1.1 MILESTONES entry should be indistinguishable in structure from the v1.2 entry a reader already knows — full parity, graded outcomes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-planning-doc-ui-hygiene-sweep*
*Context gathered: 2026-05-30*
