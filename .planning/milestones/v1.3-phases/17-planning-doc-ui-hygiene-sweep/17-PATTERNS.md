# Phase 17: Planning-Doc + UI Hygiene Sweep - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 3 code (UIDN-04/05) + 4 doc workstreams (DOCS-05/06/07/08)
**Analogs found:** 7 / 7 (every target has an in-repo template)

> Two disjoint workstreams. **Plan B (UI Card migration)** is the primary pattern-mapping target — all analogs are real source files. **Plan A (doc hygiene)** maps each Markdown deliverable to an existing planning-doc template; no code analogs.

---

## File Classification

### Plan B — UI Card migration (code)

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/components/admin/AdminsList.tsx` | component (admin list) | request-response (read + mutation triggers) | `src/components/ui/card.tsx` (primitive) + `LandingPage.tsx` (consumer) | exact (target pattern) |
| `src/components/admin/CategoriesList.tsx` | component (admin list, inline CRUD) | request-response (CRUD via hooks) | `src/components/ui/card.tsx` + `AdminsList.tsx` (sibling, same migration) | exact (target pattern) |
| `src/components/admin/PromoteAdminDialog.tsx` | component (dialog) | request-response (search + mutation) | `src/components/ui/card.tsx` (CardContent inside Dialog) | role-match (Card-in-dialog has no exact precedent) |

### Plan A — Doc hygiene (Markdown)

| Deliverable | Role | Data Flow | Template Analog | Match Quality |
|-------------|------|-----------|-----------------|---------------|
| DOCS-08: v1.1 `MILESTONES.md` entry | doc (milestone retrospective) | transform (curate) | `.planning/MILESTONES.md` v1.2 entry (lines 3–90) | exact (canonical template, D-08) |
| DOCS-05: VALIDATION.md frontmatter (01–04) | doc (frontmatter backfill) | transform | `01-VALIDATION.md` frontmatter (lines 1–9) | exact |
| DOCS-06: `03-VERIFICATION.md` retrospective | doc (verification + "Subsequent evolution") | transform | existing `03-VERIFICATION.md` frontmatter + section skeleton | exact (extend in place) |
| DOCS-07: SUMMARY `requirements-completed` backfill | doc (frontmatter backfill) | transform | per-phase VERIFICATION.md Requirements Coverage tables | role-match |

---

## Pattern Assignments — Plan B (UI Card migration)

### Shared target: `src/components/ui/card.tsx` (the vendored primitive)

All three components compose against these exports. **The executor must read the live primitive — do not assume default paddings.** Key facts the planner needs:

- `Card` ships `flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm` (note: **vertical padding `py-6` is on Card itself**, horizontal padding lives on Header/Content via `px-6`).
- `CardHeader` is a CSS grid that **auto-promotes a 2-column layout when a `CardAction` child is present**: `has-data-[slot=card-action]:grid-cols-[1fr_auto]`. This is exactly why D-02 puts the section `<Button>` inside `<CardAction>` — the header title/action row is handled by the primitive, replacing the current hand-rolled `flex items-center justify-between`.
- `CardContent` is just `px-6`. Overriding with `p-0` (D-03) removes horizontal padding so `divide-y` rows reach the card border. **`Card`'s own `py-6` still applies** — so full-bleed rows will still have 24px top/bottom gap from the card edge unless that is also addressed. Executor should diff the live render; if edge-to-edge top/bottom is wanted, the `py-6` on `Card` is the lever, not `CardContent`. (Claude's Discretion per CONTEXT.md covers `p-0` vs `px-0`.)

**Card primitive composition reference** (`src/components/ui/card.tsx` lines 5–72): Card → CardHeader (grid, action-aware) → CardTitle (`leading-none font-semibold`) → CardAction (`col-start-2 row-span-2 row-start-1 self-start justify-self-end`) → CardContent (`px-6`).

---

### `src/components/admin/AdminsList.tsx` (component, request-response)

**Analog for target look:** `src/components/auth/LandingPage.tsx` lines 11 (`<Card className="bg-card rounded-xl border ...">`) + `src/components/ui/card.tsx`.

**Current structure to replace** (`AdminsList.tsx` lines 80–162):
```tsx
<div>
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-base font-semibold">Admins</h2>
    <Button onClick={() => setPromoteOpen(true)} size="sm" className="h-9">
      <UserPlus className="h-4 w-4 mr-1" />
      Promote admin
    </Button>
  </div>
  {loading ? (
    <div className="divide-y border rounded-md"> ...3 skeletons... </div>
  ) : (
    <div className={admins.length === 0 ? '' : 'divide-y border rounded-md'}>
      ...empty state | rows...
    </div>
  )}
  <PromoteAdminDialog .../>
  {demoteTarget && <DemoteAdminDialog .../>}
</div>
```

**Target composition** (per UI-SPEC lines 114–141; new imports add `Card, CardHeader, CardTitle, CardAction, CardContent` from `@/components/ui/card`):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Admins</CardTitle>
    <CardAction>
      <Button onClick={() => setPromoteOpen(true)} size="sm" className="h-9">
        <UserPlus className="h-4 w-4 mr-1" /> Promote admin
      </Button>
    </CardAction>
  </CardHeader>
  <CardContent className="p-0">
    {loading ? (
      <div className="divide-y">{/* 3x h-[64px] skeleton, data-testid="admin-skeleton" */}</div>
    ) : admins.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-16 text-center">...</div>
    ) : (
      <div className="divide-y">{admins.map(...)}</div>
    )}
  </CardContent>
  <PromoteAdminDialog .../>   {/* dialogs stay OUTSIDE Card or as siblings — see note */}
  {demoteTarget && <DemoteAdminDialog .../>}
</Card>
```

**Migration deltas to preserve (do NOT touch):**
- The `border rounded-md` classes on the inner row containers (lines 91, 101, 197) are **dropped** — the Card supplies border + radius. `divide-y` stays.
- Row internals unchanged: `flex items-center justify-between p-4 min-h-[64px]` (line 119), avatar block (lines 121–141), self-guard `isSelf` → "You" badge vs `Demote` Button (lines 142–156).
- `data-testid="admin-skeleton"` (line 96) preserved.

**Error path — copy as-is, keep OUTSIDE the Card** (`AdminsList.tsx` lines 65–78): the `if (error) return <Alert variant="destructive" role="alert">...` early-return runs *before* any Card JSX. UI-SPEC State Coverage (lines 216, 225) confirms error Alert stays outside the Card. Do not move it inside.

**Dialog placement note:** `PromoteAdminDialog` + `DemoteAdminDialog` (lines 164–184) are portalled overlays; whether they render as siblings of `<Card>` or inside it is functionally irrelevant (Radix portals to body). Keep the current sibling relationship to minimize diff. Wrap only the list section in the Card.

---

### `src/components/admin/CategoriesList.tsx` (component, request-response, inline CRUD)

**Analog:** identical migration to `AdminsList.tsx` (sibling). Use the AdminsList result as the in-repo pattern once it lands; structurally the same Card/Header/Title/Action/Content shell.

**Current structure** (`CategoriesList.tsx` lines 157–308): outer `<div>` → header `<div className="flex items-center justify-between mb-4">` with `<h2>Categories</h2>` + `New category` Button → three-way branch (`loading` skeletons / `showEmpty` placeholder / populated `divide-y border rounded-md`).

**Target deltas** (UI-SPEC lines 155–165):
- `<div>` → `<Card>`; header `<div>` → `<CardHeader>`; `<h2>` → `<CardTitle>Categories</CardTitle>`; `New category` Button → wrapped in `<CardAction>`.
- All three state branches move inside one `<CardContent className="p-0">`. Note the **loading skeleton branch currently lacks `border rounded-md`** (line 173, just `divide-y`) while the populated branch has it (line 197) — after migration both are bare `divide-y` inside CardContent, which *normalizes* this inconsistency.
- **Preserve:** `data-testid="category-skeleton"` (line 178), `h-[56px]` skeletons, row `p-4 min-h-[56px] gap-3` (lines 199, 240), inline edit/new Input rows (lines 198–234, 242–276), all `aria-label`s on icon buttons (`Save new category`, `Cancel new category`, `Edit category ${cat.name}`, `Delete category ${cat.name}` — lines 216, 226, 285, 295), destructive `text-destructive hover:text-destructive` on delete (line 294).
- **Keep OUTSIDE the Card:** the error `<Alert>` early return (lines 53–66) and the delete-confirmation `<Dialog>` (lines 310–344). Per UI-SPEC line 225 the error Alert is an early return; the Dialog is an overlay.

**Empty-state CTA nuance:** unlike AdminsList, the Categories empty state has its own `New category` Button (lines 191–194). Preserve it inside the empty-state block within `CardContent`.

---

### `src/components/admin/PromoteAdminDialog.tsx` (component, Card-inside-Dialog)

**UIDN-05 audit outcome (locked):** per UI-SPEC lines 169–203 and CONTEXT D-05, the flag **still applies** — migrate the search-results container.

**Current container** (`PromoteAdminDialog.tsx` lines 87–121):
```tsx
{results.length > 0 && (
  <div className="mt-2 border rounded-md divide-y max-h-64 overflow-auto">
    {results.slice(0, 10).map((r) => (
      <div key={r.id} className="flex items-center gap-2 p-2 hover:bg-accent rounded-md min-h-[44px]">
        ...
      </div>
    ))}
  </div>
)}
```

**Target** (UI-SPEC lines 183–203):
```tsx
{results.length > 0 && (
  <Card className="mt-2 max-h-64 overflow-auto">
    <CardContent className="p-0">
      <div className="divide-y">
        {results.slice(0, 10).map((r) => (
          <div key={r.id} className="flex items-center gap-2 p-2 hover:bg-accent min-h-[44px]">
            ...
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

**Deltas:**
- `border rounded-md divide-y max-h-64 overflow-auto` on the container → `Card className="mt-2 max-h-64 overflow-auto"` (scroll containment + margin move to Card) + inner `<CardContent className="p-0"><div className="divide-y">`.
- **Remove the per-row `rounded-md`** (line 92): rows inside a Card don't need individual rounding (UI-SPEC line 201). Keep `hover:bg-accent`, `p-2`, `min-h-[44px]`, the avatar/username/Discord-ID block (lines 94–110), and the `Promote` Button (lines 111–117) unchanged.
- **ARIA verification (mandatory, D-05):** `<Card>`/`<CardContent>` are generic `data-slot` `<div>`s (see `card.tsx` lines 7, 66) — no `role` attribute. The Dialog's `role="dialog"` + `aria-labelledby` live on `DialogContent` (line 65). Confirm via render/diff that no role is introduced. UI-SPEC lines 177, 313 pre-confirm no conflict; executor must still assert it.
- **Leave untouched:** Section 2 (paste Discord ID, lines 129–156), the `showNoMatches` `<p>` (lines 122–126), snowflake validation logic.

---

## Shared Patterns — Plan B

### Native Card look (D-01)
**Source:** `src/components/auth/LandingPage.tsx` line 11 + `src/components/auth/AuthErrorPage.tsx` line 63
**Apply to:** all three components
```tsx
<Card className="bg-card rounded-xl border ...">
```
Both consumers let the primitive's `rounded-xl border bg-card shadow-sm` (card.tsx line 10) stand — they add layout padding, not visual overrides. The admin migration follows suit: **do not override radius/border/shadow to chase pixel-parity with the old `rounded-md`**. Larger snapshot/visual diffs are accepted.

### One Card per section, never per row (D-04)
**Origin:** Phase 12 UIDN-03 sweep (referenced in CONTEXT lines 76, 88).
**Apply to:** AdminsList, CategoriesList, PromoteAdminDialog.
Rows live inside a single `<CardContent>` with `divide-y`. Forbidden: wrapping each `admins.map`/`categories.map`/`results.map` row in its own `<Card>`.

### Error Alert stays outside the Card
**Source pattern:** `AdminsList.tsx` lines 65–78, `CategoriesList.tsx` lines 53–66.
**Apply to:** AdminsList + CategoriesList.
The `if (error) return <Alert variant="destructive" role="alert">` early-return is reached before Card JSX renders. Preserve `role="alert"` and the `Retry` Button.

### WHY-only source comments (D-10)
No `UIDN-04` / `UIDN-05` / `Phase 17` tags in `src/`. Existing WHY comments (e.g. AdminsList line 64 "Surface fetch failures explicitly", line 114 self-demotion guard) are the correct style — preserve them; do not add phase-ID archaeology.

---

## Pattern Assignments — Plan A (doc hygiene)

### DOCS-08: v1.1 `MILESTONES.md` entry — **HARD REQ**

**Template analog:** the **v1.2 entry in `.planning/MILESTONES.md` (lines 3–90)** — canonical per D-08, manual curation only (no CLI extraction).

**Section skeleton to reproduce in full parity (D-06):**
```
## v1.1 — <name>
**Shipped:** / **Phases:** / **Tag:** / **Production URL:** / **Known deferred items at close:**
### Delivered
### Key Accomplishments        (numbered, one per phase)
### Stats                      (| Metric | Value | table)
### Decimal Phases             ("None for v1.1 — ..." if empty, D-06)
### Key Decisions (with outcomes)   (| Decision | Outcome | with ✓/⚠️ verdicts — D-07)
### Issues Resolved During Milestone
### Known Gaps Carried Forward
### Known Tech Debt
### Issues Deferred to <next>
---
*ROADMAP archive: [...]*  /  *REQUIREMENTS archive: [...]*
```
**Outcome-grading style (D-07)** — copy the verdict column form from v1.2 (lines 45–57):
```
| <decision> | ✓ Good — <hindsight rationale> |
| <decision> | ⚠️ Revisit — <open follow-up + trigger> |
```
**Source content:** `.planning/milestones/v1.1-ROADMAP.md` (phases 7–10) + subsequent SUMMARY/VERIFICATION evidence from phases 12–16 to grade whether the UIDN-03 button sweep / E2E locator scoping held up (CONTEXT lines 32, 60).
**Placement:** insert the new `## v1.1` block between the v1.2 entry (ends line 92) and the v1.0 entry (begins line 94), preserving reverse-chronological order.

### DOCS-05: VALIDATION.md frontmatter backfill (phases 01–04)

**Template analog:** `01-VALIDATION.md` frontmatter (lines 1–9):
```yaml
---
phase: 1
slug: foundation-authentication
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-06
last_updated: 2026-05-07
---
```
**⚠️ State-drift finding for the planner:** CONTEXT.md (lines 62–65) describes the DOCS-05 target as still-stale (`status: draft`, `nyquist_compliant: false`). **As of this mapping, all four files (01/02/03/04) already read `status: complete` + `nyquist_compliant: true`** (verified against the live archive). The backfill may already be done, or partially. **The executor must re-audit each of the four VALIDATION.md frontmatters against the desired shape before editing** — do not blindly apply a diff that is already in place. The shape above is the target either way.

### DOCS-06: `03-VERIFICATION.md` retrospective + "Subsequent evolution"

**Template analog:** the **existing `03-VERIFICATION.md`** at `.planning/milestones/v1.0-phases/03-response-integrity/03-VERIFICATION.md`.

**⚠️ Finding:** a `03-VERIFICATION.md` **already exists** with retroactive frontmatter (`status: resolved`, `retroactive: true`, multi-line `retroactive_rationale`, `deferred_items`) and sections: Executive Summary, Observable Truths, UAT Summary, Requirements Coverage, Plan-Level Verdicts, Deferred Items, Cross-Phase Integration. CONTEXT/DOCS-06 calls for `status: retrospective` + a **"Subsequent evolution"** section listing migrations 3–9 + Migration 14 (DBHY-01). **No "Subsequent evolution" section exists anywhere in `.planning/` archives** (grep-confirmed — only referenced in ROADMAP/REQUIREMENTS/research as a spec, not yet authored). So this is a **new section appended to (or a reconciled rewrite of) the existing file**, not a greenfield doc.

**Planner must resolve the `status` value:** existing reads `status: resolved`; DOCS-06 spec says `status: retrospective`. Treat the existing frontmatter as the structural template and reconcile the status field per the locked spec. The "Cross-Phase Integration" section (line 95) is the natural neighbor/home for "Subsequent evolution" content.

**Migration 14 evidence source:** `.planning/phases/14-security-definer-search-path-migration/` (CONTEXT line 67) — the most-recent auth-path change to name in the evolution list.

### DOCS-07: SUMMARY `requirements-completed` backfill

**Template analog:** there is no single canonical `requirements-completed` frontmatter example to copy; derive the REQ-ID list per phase from each phase's **VERIFICATION.md "Requirements Coverage" table** (e.g. `03-VERIFICATION.md` § Requirements Coverage, line 66) cross-referenced against archive REQUIREMENTS.
**Targets** (CONTEXT line 68, all under `.planning/milestones/v1.0-phases/`): SUMMARY frontmatter for phases **02, 03-02, 04-02, 04-04, 01-04**.
**Pattern:** add a `requirements-completed:` YAML list of the REQ-IDs that phase closed, sourced from that phase's VERIFICATION Requirements Coverage / archive REQUIREMENTS rows. No code analog — this is a frontmatter-list backfill keyed off verification evidence.

---

## Shared Patterns — Plan A (doc hygiene)

### Manual curation, no auto-extraction (D-08)
All four doc deliverables are hand-curated. The v1.2 MILESTONES entry's manual, graded style is the standard. Do not script REQ-ID extraction or outcome grading.

### Audit-before-edit (applies to DOCS-05 and DOCS-06)
Both have **live state that diverges from the CONTEXT.md description** (VALIDATION frontmatters appear already-backfilled; a VERIFICATION.md already exists). Every doc task should begin by reading the current file and reconciling against the spec, not applying a presumed diff.

---

## Snapshot / Test Reality Check (cross-cutting, Plan B)

**Critical finding for the planner — overrides the UI-SPEC "Snapshot Test Contract":**

- **There are no `.snap` files anywhere in the repo** (`find . -name "*.snap"` → empty). The UI-SPEC § "Snapshot Test Contract" (lines 332–345) names `AdminsList.test.tsx.snap` / `CategoriesList.test.tsx.snap` / `PromoteAdminDialog.test.tsx.snap` — **none of these exist**.
- The real tests are `src/__tests__/admin/admins-tab.test.tsx` and `src/__tests__/admin/categories-tab.test.tsx`. They use **behavioral Testing-Library assertions** (role/text queries, `fireEvent`, mocked hooks) — `grep` finds **zero `toMatchSnapshot`** and **zero className/`data-slot`/`border rounded-md`/`divide-y` structural assertions**.
- **Implication:** the Card migration is unlikely to break these tests (they assert behavior + text, not DOM structure), and there are no snapshot files to regenerate. The D-11 "update snapshots in the same commit" instruction has **no `.snap` artifact to update**. The planner should re-scope D-11 to: run `npm run test` to confirm the behavioral admin tests still pass post-migration, and (optionally) add structural assertions if desired — but there is no existing snapshot baseline to diff.
- `data-testid="admin-skeleton"` and `data-testid="category-skeleton"` are the only structural hooks the tests may rely on — these are explicitly preserved by the migration (UI-SPEC lines 317–318).

---

## No Analog Found

None. Every code target maps to the Card primitive + an existing consumer; every doc target maps to an existing planning-doc template. The two genuine *gaps* are noted inline above (no "Subsequent evolution" section authored yet; no `.snap` baseline) — these are missing artifacts to create/skip, not missing patterns.

---

## Metadata

**Analog search scope:** `src/components/ui/`, `src/components/auth/`, `src/components/admin/`, `src/__tests__/admin/`, `.planning/MILESTONES.md`, `.planning/milestones/v1.0-phases/{01,02,03,04}/`
**Files scanned:** 3 target components + Card primitive + 2 Card consumers + 2 admin test files + MILESTONES.md + 4 VALIDATION frontmatters + 1 VERIFICATION.md
**Pattern extraction date:** 2026-05-30
