# Phase 13: UIDN-02 Mobile Audit Closure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 13-uidn-02-mobile-audit-closure
**Areas discussed:** Hydration-wait strength, Auth pass for /topics + /archive, Variance disposition if scores miss 90, Evidence file shape

---

## Hydration-wait strength

### Q1: Trust PR #24 fix as-is, or strengthen?

| Option | Description | Selected |
|--------|-------------|----------|
| Trust as-is, validate by rerun | Lines 80/161 already wait up to 5s for `body.filter({hasText: mustSee})`. Run once; if zero F6 + zero dupes, ship. Cheap, empirical. Risk: prod throttling could mask hydration on a slow run. | |
| Strengthen with deterministic sentinel | Add a stable post-hydration marker the harness waits on. More resilient to text-shape drift. | ✓ |
| Replace with stricter wait strategy | Drop the text-filter; use `page.waitForFunction(...)` or `waitForSelector`. Closer to a hard-gate; abandons F6 warning-only philosophy. | |

**User's choice:** Strengthen with deterministic sentinel.

### Q2: What sentinel to wait on?

| Option | Description | Selected |
|--------|-------------|----------|
| Existing always-rendered shell element | Wait on a stable shell selector. Zero src/ edits — preserves Phase 9 closure invariant. | ✓ |
| `data-app-ready` attribute via main.tsx | ONE src/ edit (useEffect setting `document.body.dataset.appReady`). Bulletproof but breaks zero-src/-edits invariant. | |
| Per-route mustSee selector + DOM probe | Replace text-filter with per-route stable selector. Stronger than text-contains, weaker than global hydration marker. | |

**User's choice:** Existing always-rendered shell element.

### Q3: How strict should the wait be?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft + 10s (extend timeout, keep .catch) | Wait up to 10s for the sentinel; .catch swallows misses. Generous for prod first-byte. F6 stays warning-only; sha256 dupe check (Q4) is the real backstop. | ✓ |
| Hard fail on miss + 10s | Drop .catch. If sentinel doesn't appear within 10s, abort the route's screenshot. Closest to F2 hard gate. Loses warning-only philosophy. | |
| Soft + 5s (keep PR #24 timeout) | Same as PR #24's 5s, just with the new sentinel selector. Smallest delta. | |

**User's choice:** Soft + 10s.

### Q4: sha256 dupe check?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard fail on dupes | After the run, group PNGs by sha256; any 2+ sharing a hash → log paths + exit non-zero. Catches Phase 9 defect signature precisely. Free — MANIFEST already records sha256. | ✓ |
| Warn but don't fail | Log a WARN line but exit 0. Operator decides. F2 gate still depends on operator vigilance. | |
| No check — trust the sentinel + DOM probe | Skip the dupe check; trust the sentinel + DOM probe. Risk: with .catch swallowing sentinel timeouts, slow prod could silently re-capture loading shells with no signal. | |

**User's choice:** Hard fail on dupes.

**Notes:** User initially asked for clarification on this question. Recommendation provided (hard fail, with rationale: the soft + .catch sentinel choice creates a need for a deterministic backstop). User confirmed Option 1 after re-ask.

### Q5: Which exact selector?

| Option | Description | Selected |
|--------|-------------|----------|
| `[aria-label="Toggle color theme"]` | Theme toggle Button at Navbar.tsx:76. Always rendered (sits BEFORE the auth ternary at line 98). Stable shadcn primitive. | ✓ |
| `[aria-label="WTCS Community Suggestions"]` | Brand logo Link at Navbar.tsx:30. Equally stable; aria-label is product naming. Leftmost in tree. | |
| `header.sticky.top-0` (the wrapping element) | Most generic. Risk: future Tailwind class swap silently breaks the selector. | |

**User's choice:** `[aria-label="Toggle color theme"]`.

### Q6: Pass-B uniformity?

| Option | Description | Selected |
|--------|-------------|----------|
| Same sentinel + dupes spanning Pass-B | Apply uniformly to all 42 PNGs. Single coherent strategy. Catches future regressions if local-preview hydration ever races. | ✓ |
| Sentinel for both, dupe check only on Pass-A | Apply sentinel uniformly but scope dupe-detection to Pass-A (where Phase 9 defect actually surfaced). | |
| Leave Pass-B alone | Pass-B landed cleanly in Phase 9. Don't touch what works. Smallest blast radius. | |

**User's choice:** Same sentinel + dupes spanning Pass-B.

---

## Auth pass for /topics + /archive

### Q1: Where do auth /topics + /archive captures land?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Pass-B to 4 sub-routes | Pass-B already runs against localhost with fixture admin auth. Add /topics + /archive to AUTH_ROUTES. Reuses existing signInWithPassword infra. | ✓ |
| New Pass-C, separate auth-on-prod attempt | Try Discord OAuth against prod. Phase 9 RESEARCH already rejected this (Pattern 2 Option A). | |
| Refactor Pass-A to be auth-conditional | Restructure UNAUTH_ROUTES so requiresAuth: true routes get fixture session + LOCAL_URL. Cleaner conceptually but mixes prod+local in one pass. | |

**User's choice:** Extend Pass-B to 4 sub-routes.

### Q2: Which fixture user?

| Option | Description | Selected |
|--------|-------------|----------|
| memberUser, split into 2 contexts | Use `memberUser` for /topics + /archive; keep `adminUser` for /admin/*. Two Playwright contexts. Captures REAL voter UI. | ✓ |
| adminUser everywhere, single context | Reuse existing Pass-B context's admin session for all 4 sub-routes. Smallest diff. Caveat: Navbar shows Admin link. | |
| memberUser for everything, drop /admin/* | Loses /admin/suggestions/new + /edit screenshots. Phase 9 deliberately captured those — regression. | |

**User's choice:** memberUser, split into 2 contexts.

### Q3: What happens to unauth /topics + /archive in Pass-A?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop unauth /topics + /archive from Pass-A | Pass-A becomes 3 routes × 6 = 18 PNGs. Pass-B 4 × 6 = 24 PNGs. Total 42 (unchanged). Cleaner; no by-design dupes. /admin unauth stays per Phase 9 D-06. | ✓ |
| Keep unauth /topics + /archive, exclude from dupe check | Add `excludeFromDupeCheck: true` flag. Documents redirect behavior visually but adds complexity AND lets loading-shell defect re-hide in excluded subset. | |
| Keep them, group dupe check by finalPath | Group all PNGs by (width, finalPath); assert sha256 uniqueness within each group. Most general; most code. | |

**User's choice:** Drop unauth /topics + /archive from Pass-A.

### Q4: Naming for new auth PNGs?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain `bp-{w}-topics.png` / `bp-{w}-archive.png` | Names unambiguous now (unauth versions dropped). Matches Pass-B convention. Smallest diff. | ✓ |
| Prefix with `auth-` | Filename-level disambiguation. Inconsistent with existing Pass-B unless we rename those too. | |
| Fully qualified `bp-{w}-{auth\|unauth}-{name}.png` | Most explicit; biggest diff; renames every PNG; churns 42 MANIFEST entries. | |

**User's choice:** Plain naming.

---

## Variance disposition if scores miss 90

### Q1: Strict 90 floor or D-14 ship-anyway?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict 90 floor, no ship-anyway | Any route under 90 = Path-3 defer per ROADMAP SC4 verbatim. Phase 9 ALREADY applied D-14 once for v1.1 deferral. Cleanest forensics. | ✓ |
| Apply D-14 ship-anyway analog (1-3pp window) | Routes at 88/89 flip the row anyway with documented overage. Pro: respects Lighthouse ±5-10pp noise. Con: same negotiation Phase 9 used to defer. | |
| Multi-run median (deviate from Pitfall 1) | Run Lighthouse 3x per route, take median. Triples run time. Could justify as "v1.2 closure run only." | |

**User's choice:** Strict 90 floor, no ship-anyway.

### Q2: Follow-up trigger if defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Tied to next perf-budget change | "Rerun audit when next perf-relevant change lands (lazy-route split, image opt, bundle delta < -X kB)." Concrete trigger. | ✓ |
| v1.3 milestone review checkpoint | "Revisit at v1.3 milestone planning." Calendar-based. Risk: if v1.3 light on perf, row keeps deferring. | |
| Promote to v1.3 perf-phase requirement | Don't wait for trigger; file PERF-01 targeting v1.3 with concrete optimizations. Bigger commitment. | |

**User's choice:** Tied to next perf-budget change.

### Q3: Single-run audit policy?

| Option | Description | Selected |
|--------|-------------|----------|
| Single run, accept the numbers | Per Phase 9 Pitfall 1. No "rerun until pass" gaming. Cleanest forensic record. | ✓ |
| Allow up to 3 reruns if F6/dupe gate fails | Single Lighthouse run; allow up to 3 screenshot harness reruns if gates fail. Splits policy by harness purpose. | |
| Two-run sanity check, take the better Lighthouse | Run Lighthouse twice; take the better score per route. Deviates from Pitfall 1; biases toward optimism. | |

**User's choice:** Single run, accept the numbers.

### Q4: Where does the follow-up trigger live?

| Option | Description | Selected |
|--------|-------------|----------|
| Evidence file Sign-off + REQUIREMENTS active row | Two-surface durability without inflating the requirement set. | ✓ |
| Evidence file Sign-off only | Single source. Lower friction; worse durability. | |
| New REQUIREMENT row (PERF-FOLLOWUP-01) | First-class tracking surface. Heavier. | |

**User's choice:** Evidence file Sign-off + REQUIREMENTS active row.

---

## Evidence file shape

### Q1: How is the v1.2 rerun evidence recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| Append `## v1.2 Rerun` section, update frontmatter | Single source of truth. v1.1 baseline stays as-is. Mirrors OBSV-02-bundle-delta.md growth pattern. | ✓ |
| New file UIDN-02-mobile-evidence-v1.2.md, cross-link baseline | Standalone. Splits audit history across files. | |
| New v1.2 section + separate stat block in PROJECT.md | Most discoverable; second source-of-truth that has to stay in sync. | |

**User's choice:** Append section + update frontmatter.

### Q2: Frontmatter status convention?

| Option | Description | Selected |
|--------|-------------|----------|
| `complete-v1.2` / `deferred-v1.2` | Milestone-tagged; future readers know which audit cleared. Matches OBSV-02 convention. | ✓ |
| `complete` / `deferred` (no version suffix) | Cleaner; bare status doesn't say WHICH run cleared. | |
| `audited` / `closed` / `deferred` (3-state lexicon) | Most expressive; introduces vocabulary other closure files don't use. | |

**User's choice:** `complete-v1.2` / `deferred-v1.2`.

### Q3: PROJECT.md row update wording?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Phase 9 convention with v1.2 tag | `✓ Good (v1.2 — Lighthouse Perf 5/5 ≥ 90; see ...)` or `⚠️ Revisit (v1.2 rerun — N/5 routes under 90; follow-up tied to next perf-budget change; see ...)`. Inline path = clickable. | ✓ |
| Terse with issue-link only | Half the text. Drops scores + path. | |
| Verbose with all 5 scores inline | Self-documenting; row gets very long. | |

**User's choice:** Mirror Phase 9 convention with v1.2 tag.

### Q4: Cross-references in v1.2 section?

| Option | Description | Selected |
|--------|-------------|----------|
| v1.2 section adds only NEW refs | v1.1 baseline keeps its full cross-ref block; v1.2 section adds Phase 13 CONTEXT/PLAN, harness diff, Phase 12 prod commit. | ✓ |
| Re-list everything in v1.2 section | Self-contained; maintenance burden if Phase 9 ref ever moves. | |
| Move all cross-refs to a shared appendix | Cleanest dedup; biggest diff to existing file structure. | |

**User's choice:** v1.2 section adds only new refs.

---

## Claude's Discretion

- Exact harness diff line count and code style for the sentinel + dupe-check insertions.
- Commit/PR shape (single atomic commit vs WAVE-1 + WAVE-2) — likely single per Phase 9 Path-3 pattern.
- MANIFEST.json prune logic for the dropped Pass-A `/topics` + `/archive` entries.
- Pass-B context cleanup ordering (admin context closes after `/admin/*` loop, member context closes after `/topics + /archive` loop).
- Sign-off paragraph wording in italics-form (matches Phase 9 + OBSV-02 convention).

## Deferred Ideas

- PERF-FOLLOWUP-01 first-class requirement row.
- Multi-run Lighthouse averaging / two-run sanity check.
- D-14 ship-anyway analog re-application.
- `data-app-ready` attribute on body via main.tsx useEffect.
- Auth-`/admin` Lighthouse audit against prod.
- `auth-` filename prefix for auth captures.
- New file UIDN-02-mobile-evidence-v1.2.md.
- Cross-ref appendix refactor.
- Verbose 5-score row update wording in PROJECT.md.
- CI integration of the dupe check / closure harness.
