# Phase 9: UI Closure Evidence - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>

## Phase Boundary

Three closure-evidence artifacts produced so PROJECT.md Key Decisions flip from ⚠️ Revisit → ✓ Good for `Mobile-first responsive design` and `shadcn/ui + Tailwind CSS v4 (Maia/Neutral)`. The shadcn preset discrepancy (UIDN-04) is reconciled in writing first — no component restyle.

**In scope:**
- UIDN-04 reconciliation: confirm `new-york` as canonical, flip the two losing surfaces (DESIGN-SYSTEM.md style line, PROJECT.md Constraints), append ADR-style note to `.planning/DESIGN-SYSTEM.md`. Must complete before UIDN-03 audit runs (UIDN-03 cites the canonical preset).
- UIDN-02 mobile evidence: Lighthouse mobile audit (Perf≥90 / A11y≥95 / BP≥95 / SEO≥90) + 6-width screenshot matrix (320/375/414/768/1024/1440 px) on the locked route set, archived under `.planning/closure/artifacts/`. Output: `.planning/closure/UIDN-02-mobile-evidence.md`.
- UIDN-03 shadcn audit: 12-item per-route consistency checklist applied across the locked route set, citing the new-york canonical preset. Output: `.planning/closure/UIDN-03-shadcn-audit.md`.
- Re-runnable audit harness: `.planning/closure/audit-mobile.sh` (Lighthouse loop) + `.planning/closure/audit-screenshots.mjs` (Playwright).
- PROJECT.md Key Decisions table flipped for both rows after closure files land.

**Out of scope:**
- Any shadcn component restyle or preset migration (ROADMAP SC #5 scope guard — UIDN-04 is documentation reconciliation only).
- Lighthouse CI / LHCI in GitHub Actions — deferred to v1.2 per v1.1 research cross-cutting decision.
- Lighthouse coverage of `/admin/suggestions/new` and `/admin/suggestions/$id/edit` (auth-gated sub-routes covered via screenshot+checklist only).
- New product features — SEED-002 admin visibility belongs in v1.2.
- DOCS-01..04 backfill — that is Phase 10's scope.
- Phase 10 (CLAUDE.md / metadata sweep) — flagged in this phase but not edited unless atomic with UIDN-04.

</domain>

<decisions>

## Implementation Decisions

### UIDN-04 — shadcn style canonicality
- **D-01:** `new-york` is canonical. Rationale: components shipped against `new-york` per `components.json`; documentation surfaces (DESIGN-SYSTEM.md, PROJECT.md Constraints) were aspirational. Aligns with v1.1-MOBILE-AUDIT.md § Open questions #1.
- **D-02:** UIDN-04 ADR pass updates **both** losing surfaces atomically: `.planning/DESIGN-SYSTEM.md` UI framework `Style:` line flips Maia → new-york AND `.planning/PROJECT.md` Constraints "shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font" line flips Maia → new-york. ADR-style note appended to `.planning/DESIGN-SYSTEM.md` documenting the discrepancy, the decision (new-york wins because shipped), and the no-restyle scope guard. Single atomic commit.

### UIDN-02 + UIDN-03 — audit target & runner
- **D-03:** Audit target is **production only** (`https://polls.wtcsmapban.com`). Rationale: real bundle, real network, only the prod artifact certifies the flip. No deploy preview, no `npm run preview`. Re-running on UI changes is a separate (re-)audit, not a Phase 9 obligation.
- **D-04:** Audit harness lives under `.planning/closure/` as standalone scripts: `.planning/closure/audit-mobile.sh` (Lighthouse CLI loop over the route set) and `.planning/closure/audit-screenshots.mjs` (Playwright resize + screenshot loop). **No** `package.json` scripts added — audit is a milestone artifact, not a permanent build target. Researcher/planner pick exact script internals.
- **D-05:** Route inventory for full audit (Lighthouse + screenshot matrix + checklist) is **5 routes**: `/` (index), `/topics`, `/archive`, `/auth/error`, `/admin` (index). Sub-routes `/admin/suggestions/new` and `/admin/suggestions/$id/edit` covered via screenshot matrix + 12-item checklist **only** (no Lighthouse). Skip `/__smoke` (debug-gated, not user-touchpoint) and `/auth/callback` (transient OAuth redirect, no UI).
- **D-06:** `/admin` Lighthouse runs **as guest** — captures the redirect-to-login experience, which IS the experience for an unauthenticated visitor. Authenticated `/admin*` screenshot capture uses the existing Phase 8 Playwright auth fixture / storage state from `e2e/helpers/auth.ts`. No `--extra-headers` session injection in this phase.

### UIDN-03 — checklist content authoring
- **D-07:** Researcher drafts the 12 checklist items from `.planning/research/v1.1-MOBILE-AUDIT.md § shadcn Maia/Neutral compliance checklist`, **re-keyed against the new-york canonical preset** (per UIDN-04). Planner reviews and locks before audit execution. CONTEXT.md does not enumerate the 12 items — they belong in RESEARCH/PLAN.

### Claude's Discretion
- Exact internals of `audit-mobile.sh` and `audit-screenshots.mjs` (loop structure, output-path naming, parallelism). Constrained by D-03 + D-05 only.
- ADR prose / heading structure inside DESIGN-SYSTEM.md (no project ADR convention exists yet — researcher establishes a minimal one).
- Whether to also flip `CLAUDE.md` line 21 (`shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font`) atomically with UIDN-04 or note it for the Phase 10 planning-hygiene backfill. CLAUDE.md may be auto-derived from PROJECT.md — if so, regenerate; if hand-maintained, edit in this phase.
- Wave ordering and commit cadence within Phase 9. Required ordering is UIDN-04 → UIDN-02 (parallel) → UIDN-03 per ROADMAP; planner picks within that.
- Sign-off line wording at the end of each closure file (research suggests dated sign-off; exact phrasing is open).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements (locked)
- `.planning/ROADMAP.md` § Phase 9: UI Closure Evidence — Goal, dependencies, success criteria, intra-phase ordering (UIDN-04 → UIDN-02 → UIDN-03).
- `.planning/REQUIREMENTS.md` § UI & Design — UIDN-02, UIDN-03, UIDN-04 wording (also see `Future Requirements` and `Out of Scope` for v1.1 boundary).

### Research (locked technical approach)
- `.planning/research/v1.1-MOBILE-AUDIT.md` § Lighthouse audit setup — CLI command template, threshold targets, "one-off this milestone" decision.
- `.planning/research/v1.1-MOBILE-AUDIT.md` § Mobile breakpoint matrix template — screenshot harness shape.
- `.planning/research/v1.1-MOBILE-AUDIT.md` § shadcn Maia/Neutral compliance checklist — source for D-07 (re-key against new-york).
- `.planning/research/v1.1-MOBILE-AUDIT.md` § Closure evidence file structures — exact section layout for the two evidence files.
- `.planning/research/v1.1-SUMMARY.md` § Cross-Cutting Decisions — closure-evidence directory convention; LHCI deferral.

### UIDN-04 surfaces (must be edited atomically)
- `components.json` — read-only ground truth (`style: "new-york"`, `baseColor: "neutral"`).
- `.planning/DESIGN-SYSTEM.md` § UI framework — `Style:` line to flip; ADR appended at end.
- `.planning/PROJECT.md` § Constraints — "shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font" line to flip.
- `.planning/PROJECT.md` § Key Decisions — `Mobile-first responsive design` and `shadcn/ui + Tailwind CSS v4 (Maia/Neutral)` rows flip ⚠️ Revisit → ✓ Good after closure files land.
- `CLAUDE.md` line 21 — preset cite review (Claude's Discretion: edit here or defer to Phase 10).

### Closure & verification analogs (pattern source)
- `.planning/closure/OBSV-02-bundle-delta.md` — closure-evidence file analog from Phase 7 (section structure, dated sign-off, artifact path convention).
- `.planning/phases/07-observability-hardening/07-CONTEXT.md` § Established Patterns — "Closure-evidence pattern from v1.1 milestone" carried forward.

### Reusable infrastructure
- `e2e/helpers/auth.ts` (Phase 8 fixture) — auth-state source for authenticated `/admin*` screenshot capture.
- `e2e/playwright.config.ts` — Playwright config Reuse for the screenshot script.

### Project decisions that carry forward
- `.planning/PROJECT.md` § Constraints — $0 budget, Netlify free tier (rules out LHCI burn).
- Source-comment policy: WHY-only, no review-round / phase-ID archaeology in `src/` (project rule).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Playwright (devDeps, Phase 8)** — already configured. `audit-screenshots.mjs` reuses the same browser/launch options; auth-state fixture from `e2e/helpers/auth.ts` provides authenticated `/admin*` capture without re-implementing login.
- **`.planning/closure/OBSV-02-bundle-delta.md`** — Phase 7 closure file. Structural analog for UIDN-02 + UIDN-03 evidence files: title → context → method → results table → dated sign-off line that flips PROJECT.md Key Decisions.
- **`.planning/closure/artifacts/`** — directory convention already in use; Lighthouse JSON+HTML and screenshot PNGs land here.
- **`components.json` baseColor `neutral` + `cssVariables: true`** — UIDN-03 checklist anchors to these declared tokens; not editing them (no restyle).

### Established Patterns
- **Closure-evidence pattern** (Phase 7 D-): `.planning/closure/<REQ-ID>-<topic>.md` + artifacts in `.planning/closure/artifacts/`. Phase 9 produces two such files plus a third file for the harness scripts.
- **Dated sign-off line at end of evidence file** flips PROJECT.md Key Decisions — atomic with the file landing in the same commit.
- **Source comments are WHY-only** (no plan-cite archaeology). Phase 9 touches no `src/` code, so the rule applies only to script files in `.planning/closure/` (allowed to be terse and runbook-style; this is `.planning/`, not `src/`).
- **No new package.json scripts for milestone artifacts** (Phase 7/8 precedent: tools that won't outlive the milestone live as standalone scripts under `.planning/`).

### Integration Points
- **`.planning/PROJECT.md` Key Decisions table** — two rows flipped after the closure files land. Atomic commit per row (or single commit at phase end — planner picks).
- **`.planning/DESIGN-SYSTEM.md`** — UIDN-04 ADR appended; the existing brief stays. Style line flipped in the same edit.
- **Phase 10 boundary** — Phase 10 backfills VALIDATION/SUMMARY frontmatter on phases 01–04. Phase 9 must not touch those phase dirs. CLAUDE.md preset cite (line 21) sits on the boundary — Claude's Discretion D-Discretion above.

</code_context>

<specifics>
## Specific Ideas

- **Branch:** `gsd/phase-09-ui-closure-evidence` (ROADMAP-locked).
- **ADR style:** ADR-style note appended (per ROADMAP SC #1). No prior project ADR convention; researcher proposes a minimal one (Title / Date / Decision / Reasoning / Consequences) consistent with industry-standard ADR shape.
- **Re-runnability is a soft requirement.** Audit scripts must be re-runnable end-to-end without manual editing of paths/URLs (one source of truth for the route list, threshold list, and breakpoint list — likely a small data block at the top of each script).
- **Closure files end with a dated sign-off line** ("Signed off 2026-05-DD — UIDN-02 evidence complete; PROJECT.md Key Decisions flipped to ✓ Good.") — established research convention.

</specifics>

<deferred>
## Deferred Ideas

- **Lighthouse CI (LHCI) in GitHub Actions** — v1.2 candidate per v1.1-MOBILE-AUDIT.md § Lighthouse audit setup; deferred from v1.1 to keep free-tier minutes intact.
- **Lighthouse coverage of authenticated `/admin/*` sub-routes** (`/admin/suggestions/new`, `/admin/suggestions/$id/edit`) — requires `--extra-headers` session injection or a dedicated test admin pre-auth flow. Defer to v1.2 LHCI work where session handling becomes a first-class concern.
- **Component restyle / preset migration to a different shadcn preset** — explicitly out of scope per ROADMAP SC #5 and v1.1 REQUIREMENTS § Out of Scope.
- **Real `prefers-color-scheme: dark` parity audit** — touched by the 12-item checklist but a deeper dark-mode audit can be a v1.2 polish item.
- **Project-wide ADR convention skill** — if Phase 9's ADR-style note ends up being the first ADR, formalising the format as a convention is a Phase 10 / v1.2 docs task, not Phase 9.

</deferred>
