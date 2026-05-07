---
phase: 09-ui-closure-evidence
plan: 01
subsystem: docs/design-system
tags: [docs, design-system, adr, shadcn, uidn-04]
requirements-completed: [UIDN-04]
dependency-graph:
  requires: []
  provides:
    - "Canonical shadcn style declaration (new-york) propagated across DESIGN-SYSTEM.md, PROJECT.md, CLAUDE.md"
    - "ADR-001 establishing minimal 5-section ADR convention"
  affects:
    - "Plan 09-04 (UIDN-03 audit) — checklist now keys against new-york defaults unambiguously"
    - "Plans 09-03 / 09-04 atomic Key Decisions row flips (Mobile-first / shadcn rows still ⚠️ Revisit per design)"
tech-stack:
  added: []
  patterns:
    - "ADR-001 minimal 5-section template (Context / Decision / Reasoning / Consequences / metadata) — first project ADR"
key-files:
  created: []
  modified:
    - .planning/DESIGN-SYSTEM.md
    - .planning/PROJECT.md
    - CLAUDE.md
decisions:
  - "Per D-01 (locked): new-york is canonical because it is what shipped (components.json ground truth)."
  - "Per D-02 (locked): atomic 3-surface flip in a single commit; CLAUDE.md regenerated, not hand-edited."
metrics:
  duration_minutes: 8
  tasks_completed: 4
  files_changed: 3
  completed: 2026-05-04
---

# Phase 9 Plan 1: UIDN-04 — shadcn style canonicalization (Maia → new-york) Summary

Reconciled the 3-surface shadcn-style discrepancy by declaring `new-york` canonical across DESIGN-SYSTEM.md, PROJECT.md, and CLAUDE.md, with ADR-001 documenting the rationale; zero src/ or `components.json` change.

## What Shipped

- **DESIGN-SYSTEM.md § UI framework, line 13:** `Style:` line flipped from `Maia (soft rounded corners…)` → `new-york (matches `components.json`; canonicalized in ADR-001 below)`.
- **DESIGN-SYSTEM.md tail:** ADR-001 appended in the proposed minimal 5-section shape (Context / Decision / Reasoning / Consequences) plus a metadata block (Date / Status / Phase / GitHub). Establishes the project's first ADR convention. Cites ROADMAP SC #5 no-restyle scope guard.
- **PROJECT.md § Constraints, line 170:** Single-line flip — `shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font` → `shadcn/ui new-york style, Neutral baseColor, Inter font`. Drops the now-stale `bbVJxbc` Maia preset string per RESEARCH A3.
- **CLAUDE.md:** Regenerated from PROJECT.md via `node ~/.claude/get-shit-done/bin/gsd-tools.cjs generate-claude-md` (the `<!-- GSD:project-start source:PROJECT.md -->` block is auto-derived). Line 21 now reflects the new-york line in lockstep with PROJECT.md.

## Atomic Commit

`a4c2024` — `docs(09): UIDN-04 reconcile shadcn style — Maia → new-york canonical`

Numstat:
- `.planning/DESIGN-SYSTEM.md` — 33 insertions, 1 deletion (Style line + 32-line ADR-001 block)
- `.planning/PROJECT.md` — 1 insertion, 1 deletion (Constraints line)
- `CLAUDE.md` — 7 insertions, 7 deletions (auto-derived block resync — see Deviations)

`git diff HEAD~1 --name-only`: exactly the 3 plan files. Zero `src/`, zero `components.json`.

## Decisions Made

1. **D-01 honored:** `new-york` wins over Maia because `components.json` shipped that way and Phases 1–4 components were authored against the new-york recipe.
2. **D-02 honored:** Single atomic commit; no partial flip; commit message cites D-02 reasoning (ADR-001).
3. **CLAUDE.md regen, not hand-edit:** Per RESEARCH § "CLAUDE.md Disposition" — the `GSD:project-start source:PROJECT.md` marker block is auto-derived; manual edits would be overwritten on next regen. Tool: `gsd-tools.cjs generate-claude-md` (verified at line 924 of that binary).

## Deviations from Plan

### F13 narrow-diff threshold not met (accepted with rationale)

**Found during:** Task 3 verification.

**Issue:** Plan acceptance criteria F13 demanded `git diff HEAD~1 --numstat -- CLAUDE.md` total ≤ 2 lines (1 insertion + 1 deletion for the Constraints bullet swap). Actual numstat: 7 + 7 = 14 lines.

**Root cause:** This worktree was forked from commit `620183e` (Phase 8 ship), which predates several PROJECT.md edits that landed on `main` between v1.0 close and Phase 9 planning (added "Live since 2026-04-28 (v1.0)" in What This Is, "validated through v1.0 ship", "all shipped", "with mandatory 2FA", "sliding-window 5 req/60s on submit-vote"). The pre-existing CLAUDE.md in the worktree had not yet been regenerated against those PROJECT.md updates. The GSD skills-section template also gained `.codex/skills/`. So when `generate-claude-md` ran, it correctly pulled in **both** the Plan 01 Maia → new-york flip AND the legitimate stale-content drift.

**Disposition:** Accepted (Rule 1 + Rule 2 — auto-derive correctness over hand-edited diff narrowness). Hand-trimming the regen output to satisfy F13 would (a) violate the explicit RESEARCH directive that CLAUDE.md MUST NOT be hand-edited, (b) leave the worktree's CLAUDE.md desynced from the live PROJECT.md, (c) be silently overwritten on the next regen. The Plan-01-scope line (the new-york flip) IS present and correct; the additional 12 lines of churn are pre-existing PROJECT.md drift that the regenerator caught up.

**Files affected:** CLAUDE.md only. `git diff HEAD~1 -- CLAUDE.md` shows 5 unrelated lines + 1 line for the new-york flip + 1 line in skills-section template (auto-template).

**Risk:** None. Every line of CLAUDE.md drift is verifiably already in PROJECT.md or in the GSD template registry (skills section). Auditable against `git show HEAD:.planning/PROJECT.md`.

**No further action required.** Plan acceptance overall (the 3-surface flip + atomicity + zero-src/ + zero-components.json + ADR-001) holds.

## Auth Gates

None.

## Verification Outcomes

- ✓ `grep -q 'new-york' .planning/DESIGN-SYSTEM.md .planning/PROJECT.md CLAUDE.md` — all three.
- ✓ `grep -q 'ADR-001' .planning/DESIGN-SYSTEM.md`.
- ✓ `git diff HEAD~1 --name-only | wc -l` = 3.
- ✓ `git diff HEAD~1 --name-only | grep -c '^src/'` = 0.
- ✓ `git diff HEAD~1 -- components.json` produces empty output.
- ✓ ADR-001 has 4 named subsections (Context / Decision / Reasoning / Consequences).
- ✓ ADR-001 metadata block has 4 entries (Date / Status / Phase / GitHub).
- ✓ PROJECT.md Key Decisions rows for `Mobile-first responsive design` and `shadcn/ui + Tailwind CSS v4 (Maia/Neutral)` still show `⚠️ Revisit` — atomic-per-row flips deferred to Plans 03 and 04 per RESEARCH Pitfall 7 sub-option A.
- ✓ Worktree clean post-commit; no untracked files.
- ✓ Pre-commit HEAD safety assertion + staging-area gate both passed.

## Known Stubs

None. Documentation-only plan; no UI surface introduced.

## Threat Flags

None. Documentation-only edits; no new network endpoints, auth paths, file-access patterns, or schema changes. Threat register T-09-01..T-09-03 mitigations all upheld:
- T-09-01 (info disclosure in ADR text): accept — ADR contains no secrets/PII.
- T-09-02 (tampering with components.json read-only ground truth): mitigated — `git diff HEAD~1 -- components.json` empty.
- T-09-03 (partial-flip repudiation): mitigated — single atomic commit `a4c2024` ties all three surfaces.

## Self-Check: PASSED

- ✓ FOUND: .planning/DESIGN-SYSTEM.md (modified — verified by grep `new-york` + `ADR-001`)
- ✓ FOUND: .planning/PROJECT.md (modified — verified by grep new-york Constraints line)
- ✓ FOUND: CLAUDE.md (modified — verified by grep new-york + marker block)
- ✓ FOUND: a4c2024 in `git log --oneline -1` on `worktree-agent-acd265d1a395470e2`
- ✓ Plan acceptance criteria 1–4 (Tasks 0–3) all met; F13 deviation documented above.
