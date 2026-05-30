# Phase 17: Planning-Doc + UI Hygiene Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 17-planning-doc-ui-hygiene-sweep
**Areas discussed:** Card visual treatment, v1.1 MILESTONES depth, UIDN-05 disposition, Plan/commit split

---

## Card visual treatment

### Q1 — Visual target when wrapping lists in shadcn Card

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt Card defaults | Native `rounded-xl` + `shadow-sm` + `p-6`; softer corners, more padding, subtle shadow; consistent with existing Card consumers; larger snapshot diffs but the "real" shadcn look | ✓ |
| Pixel-parity | Override Card defaults (`rounded-md`, no shadow, tighter padding) to look identical to today; fights the primitive, partly defeats the migration | |

**User's choice:** Adopt Card defaults
**Notes:** → CONTEXT D-01.

### Q2 — Section heading placement

| Option | Description | Selected |
|--------|-------------|----------|
| CardHeader + CardTitle | Move heading + action Button into `<CardHeader><CardTitle>`; most semantic; heading style shifts to CardTitle default | ✓ |
| Keep header outside the Card | Leave `<h2>` + Button above; Card wraps only the rows; preserves heading typography but Card is just a styled list container | |

**User's choice:** CardHeader + CardTitle
**Notes:** → CONTEXT D-02.

### Q3 — Divide-y row list inside CardContent padding

| Option | Description | Selected |
|--------|-------------|----------|
| Full-bleed rows | `CardContent` `p-0`/`px-0` so rows span edge-to-edge and dividers reach the card borders; rows keep their own `p-4` | ✓ |
| Inset rows | Keep default `p-6`; list floats inside padding; simpler but "box-in-a-box" look | |
| You decide | Defer to planner/executor against the live primitive | |

**User's choice:** Full-bleed rows
**Notes:** → CONTEXT D-03.

---

## v1.1 MILESTONES depth

### Q1 — Structural parity with the v1.2 template

| Option | Description | Selected |
|--------|-------------|----------|
| Full structural parity | Reproduce every v1.2 section; omit only if genuinely empty and say so; permanent gap closure + uniformity | ✓ |
| Lean summary | Delivered + Key Accomplishments + Stats only; skip decision/gaps/debt tables; faster but breaks uniformity | |

**User's choice:** Full structural parity
**Notes:** → CONTEXT D-06.

### Q2 — Retroactive outcome grading

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, graded outcomes | Backfill ✓/⚠️ verdicts using hindsight from phases 12–16; sourced from v1.1-ROADMAP.md + subsequent SUMMARY/VERIFICATION evidence | ✓ |
| Decisions only, no grades | List decisions without retroactive verdicts; lower effort but diverges from the "with outcomes" format | |

**User's choice:** Yes, graded outcomes
**Notes:** → CONTEXT D-07. Manual curation only (no CLI auto-extraction) carried forward as D-08.

---

## UIDN-05 disposition (PromoteAdminDialog)

| Option | Description | Selected |
|--------|-------------|----------|
| Audit-gated, lean toward consistency | Audit first; migrate if UIDN-03 flag still applies, else document the no-op with rationale; verify Dialog ARIA either way | ✓ |
| Always migrate for consistency | Migrate regardless of audit; risks fighting Dialog layout | |
| Strict flag-only | Migrate only if flag verifiably still applies, else hard no-op; may leave dialog visually inconsistent | |

**User's choice:** Audit-gated, lean toward consistency
**Notes:** → CONTEXT D-05.

---

## Plan/commit split

| Option | Description | Selected |
|--------|-------------|----------|
| Two plans: docs + UI | Plan A doc hygiene (Markdown-only), Plan B Card migration (code + snapshots); disjoint files, parallelizable, clean separation of doc vs code commits | ✓ |
| Single combined plan | One plan for everything; fewer moving parts but noisier mixed PR diff | |
| You decide | Defer plan-count entirely to the planner | |

**User's choice:** Two plans: docs + UI
**Notes:** → CONTEXT D-09. Planner finalizes wave/commit granularity within the split.

---

## Claude's Discretion

- Exact `CardContent` full-bleed override mechanism (`p-0` vs `px-0` + vertical tweak).
- Wave sequencing and per-task commit boundaries within the two-plan split.

## Deferred Ideas

None — discussion stayed within phase scope.
