# Phase 13: UIDN-02 Mobile Audit Closure - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that the v1.2 production deploy delivers the mobile-perf budget, fix the Plan 02 harness defect that produced byte-identical loading-shell PNGs in Phase 9, capture the missing authenticated screenshots for `/topics` and `/archive`, and produce a complete v1.2-rerun evidence corpus that either (a) flips the `Mobile-first responsive design` Key Decision row ⚠️ → ✓ if all 5 routes hit Performance ≥ 90, or (b) documents the delta with rationale and keeps ⚠️ Revisit with a follow-up trigger tied to the next perf-budget change.

**In scope (Phase 13 boundary):**
- **`audit-screenshots.mjs` harness fix** — replace the PR #24 `body.filter({hasText: mustSee}).first().waitFor({timeout: 5000}).catch(() => {})` text-filter wait with a deterministic shell sentinel (`[aria-label="Toggle color theme"]` from `Navbar.tsx:76`) at a soft 10s timeout (`.catch` preserved). Apply uniformly to BOTH passes (Pass-A + Pass-B). Zero `src/` edits — sentinel selector lives only in the harness.
- **sha256 dupe-check** — after the screenshot run, group all 42 PNGs by sha256; if any 2+ share a hash, log the offending paths and exit non-zero. Catches the Phase 9 defect signature (4-of-30 byte-identical loading shells) deterministically. MANIFEST.json already records sha256 — implementation is ~10 lines at the end of the harness.
- **Auth pass extension** — extend Pass-B to 4 sub-routes (existing 2 admin sub-routes + new `/topics` + `/archive`). Use TWO Playwright contexts inside Pass-B: `adminUser` (id `22222222-…`) for `/admin/suggestions/*`, `memberUser` (id `11111111-…`) for `/topics` + `/archive`. Captures the real voter UI (no Admin link in Navbar). Drop unauth `/topics` + `/archive` from Pass-A → Pass-A becomes 3 routes × 6 widths = 18 PNGs; Pass-B becomes 4 sub-routes × 6 widths = 24 PNGs; total 42 (unchanged). Naming stays plain (`bp-{w}-topics.png`, `bp-{w}-archive.png`) — no auth/unauth prefix.
- **Lighthouse mobile rerun** — single run of `audit-mobile.sh` against `https://polls.wtcsmapban.com` for the locked 5-route set (`/`, `/topics`, `/archive`, `/auth/error`, `/admin`). Pitfall 1 single-run policy honored: no rerun-for-better-numbers gaming. Strict 90 floor (no D-14 ship-anyway analog — Phase 9 used it once already).
- **Evidence file update** — append `## v1.2 Rerun (2026-05-XX)` section to existing `.planning/closure/UIDN-02-mobile-evidence.md`. Keep the v1.1 baseline content as-is for historical context. Update frontmatter `status: deferred` → `status: complete-v1.2` (pass) or `status: deferred-v1.2` (miss). New section adds only NEW cross-refs (Phase 13 CONTEXT/PLAN, harness diff, Phase 12 prod commit `de15e33`); v1.1 baseline cross-refs are inherited above.
- **PROJECT.md row flip** — Key Decisions row update wording mirrors Phase 9 convention with v1.2 tag and inline path to evidence:
  - Pass: `✓ Good (v1.2 — Lighthouse Perf 5/5 ≥ 90; see .planning/closure/UIDN-02-mobile-evidence.md § v1.2 Rerun)`
  - Miss: `⚠️ Revisit (v1.2 rerun — N/5 routes under 90; follow-up tied to next perf-budget change; see .planning/closure/UIDN-02-mobile-evidence.md § v1.2 Rerun)`
- **REQUIREMENTS.md UIDN-02 row** — update wording to record the v1.2 rerun outcome and follow-up trigger. On miss, row stays Active (not Complete) with the trigger named explicitly.
- **Atomic commit shape** (Phase 9 Path-3 pattern) — harness fix + Pass-B 4-route extension + dupe-check + evidence append + PROJECT.md row update + REQUIREMENTS row update land in one commit (or one PR, planner's call between single commit vs WAVE-1/WAVE-2 split).

**Out of scope (Phase 13+ or v1.3+):**
- **Any `src/` edits** — Phase 9 zero-src/-edits closure invariant carries forward; the deterministic sentinel uses an EXISTING aria-label, not a new `data-app-ready` attribute (the alternative was explicitly rejected to preserve the invariant).
- **Lighthouse `--throttling-method` / flag tuning** — Phase 9 D-05 locks the flag set; not revisited.
- **/admin Lighthouse auth-flow audit** — Phase 9 D-06 locked `/admin` to the unauth redirect-followed score (it IS the public-unauthenticated `/admin` UX). Auth `/admin` Lighthouse is impossible against prod (no fixture seed).
- **Multi-run Lighthouse averaging** — explicitly rejected; Pitfall 1 single-run policy honored.
- **D-14 ship-anyway analog re-application** — Phase 9 already used it once for the v1.1 deferral; applying it again is closer to "keep deferring until convenient" than rigorous evidence.
- **PERF-FOLLOWUP-01 new requirement row** — not promoted to a first-class requirement; follow-up trigger lives in the existing UIDN-02 row's wording + evidence file Sign-off.
- **Cross-ref appendix refactor** — kept inline per the v1.2-section-adds-only-new-refs decision.
- **CI integration of the dupe check** — not in scope; the harness exits non-zero, but no CI invocation is added (CI doesn't run the closure harness).
- **Discord OAuth-against-prod auth attempt** — explicitly rejected (Phase 9 RESEARCH Pattern 2 Option A already settled this).

</domain>

<decisions>
## Implementation Decisions

### Hydration-wait strength (Area 1)
- **D-01:** **Strengthen the PR #24 hydration-wait fix with a deterministic sentinel** (vs trust-as-is or hard-replace). The current `body.filter({hasText: mustSee}).first().waitFor({timeout: 5000}).catch(() => {})` at `audit-screenshots.mjs:80,161` was added by PR #24 but never validated by a rerun; relying on text-filter shape is fragile across route shells.
- **D-02:** **Wait on an existing always-rendered shell element** (vs adding a `data-app-ready` attribute via a `src/` edit, vs per-route mustSee selector). Preserves the Phase 9 zero-src/-edits closure invariant — sentinel selector lives only in the harness.
- **D-03:** **Sentinel selector = `[aria-label="Toggle color theme"]`** — the theme-toggle Button at `Navbar.tsx:76`. Unconditionally rendered on every route (sits BEFORE the `{user ? ... : ...}` ternary at line 98), works on `/auth/error`, works on the unauth-redirect-followed `/`. Stable shadcn primitive, semantic post-hydration marker.
- **D-04:** **Soft 10s timeout, keep `.catch`** (vs hard fail on miss, vs PR #24's 5s). Generous for prod first-byte latency on a cold Netlify hit. F6 stays warning-only philosophy on the per-PNG DOM/path probe; the deterministic backstop is the new sha256 dupe-check (D-05), not the wait itself.
- **D-05:** **Hard-fail sha256 uniqueness check across all 42 PNGs.** After the screenshot run, group PNGs by sha256; if any 2+ share a hash, log the offending paths and exit non-zero. Catches the Phase 9 defect signature precisely (`54d4f4916284…` collision across 4 PNGs in v1.1). Free — MANIFEST already records sha256. Brings `audit-screenshots.mjs` to fail-loud parity with `audit-mobile.sh`.
- **D-06:** **Apply the sentinel + dupe-check uniformly to BOTH Pass-A and Pass-B** (vs Pass-A only, vs leave Pass-B alone). Single coherent strategy, no special-casing. Pass-B uses the same Navbar so the sentinel works there too. Catches future regressions if local-preview hydration ever races.

### Auth pass for /topics + /archive (Area 2)
- **D-07:** **Extend Pass-B to 4 sub-routes** (vs new Pass-C against prod-OAuth, vs auth-conditional Pass-A). Reuses the existing `signInWithPassword` + `addInitScript` infrastructure at `audit-screenshots.mjs:122-149`. Pass-B against `localhost:4173` is the visual surrogate for prod (same Vite bundle).
- **D-08:** **Use TWO Playwright contexts inside Pass-B** — `adminUser` (id `22222222-2222-2222-2222-222222222222`) for `/admin/suggestions/*`, `memberUser` (id `11111111-1111-1111-1111-111111111111`) for `/topics` + `/archive`. Highest evidence fidelity: captures the real voter UI (no Admin link in Navbar, voter-side card chrome). loginAs's `addInitScript` stacks per-context, so two contexts is the natural way to inject two sessions.
- **D-09:** **Drop unauth `/topics` + `/archive` from Pass-A.** They redirect to `/` via AuthGuard, producing PNGs byte-identical to `/` by design — which would false-positive the new sha256 dupe-check (D-05). Pass-A becomes 3 unauth routes (`/`, `/auth/error`, `/admin`) × 6 widths = 18 PNGs. `/admin` unauth STAYS per Phase 9 D-06 (locked evidence of the public-unauth admin UX). Total matrix unchanged at 42.
- **D-10:** **Plain naming `bp-{w}-topics.png` / `bp-{w}-archive.png`** (no `auth-` prefix). With unauth versions dropped from Pass-A, the names are unambiguous. Matches existing Pass-B convention (`admin-suggestions-new` etc. are plain). Evidence file documents which Pass owns each filename.

### Variance disposition (Area 3)
- **D-11:** **Strict Performance ≥ 90 floor — no D-14 ship-anyway analog.** Phase 9 already invoked D-14 once for the v1.1 deferral; applying it twice in a row would be closer to negotiated-pass than rigorous evidence. v1.2 had a Phase 12 perf-relevant deploy + UIDN-03 sweep — if THAT can't carry the routes over 90, the ⚠️ row stays honest. Cleanest forensics.
- **D-12:** **Follow-up trigger if defer = "next perf-budget change lands."** Concrete trigger (vs open-ended "revisit someday" or v1.3 calendar). When the next perf-relevant change ships (lazy-route split, image opt, bundle delta < -X kB), rerun the audit.
- **D-13:** **Single-run audit policy honored** (Phase 9 Pitfall 1) — Lighthouse runs once per route, accept the numbers. Distinct from the screenshot harness gates (sentinel + sha256 + DOM/path probe), which CAN be debugged and rerun because that's harness work, not score gaming.
- **D-14:** **Follow-up trigger lives in BOTH the evidence file Sign-off paragraph AND the REQUIREMENTS.md UIDN-02 active row** (vs evidence-file-only, vs new PERF-FOLLOWUP-01 requirement). Two-surface durability without inflating the requirement set.

### Cross-AI review closure (Area 5 — added 2026-05-13 post-REVIEWS.md)
- **D-19:** **sha256 dupe-check uses a per-width whitelist for the home ↔ admin intentional collision pair** (vs strict global uniqueness, vs dropping `/admin` from Pass-A). `AdminGuard` navigates unauth `/admin` to `/` which renders `<LandingPage />`; `/` unauth also renders `<LandingPage />`. The PNGs at each width are therefore expected to be byte-identical — that is Phase 9 D-06 evidence (public-unauthenticated `/admin` UX), not a loading-shell defect. Implementation: build expected-collision set `{bp-{w}-home.png, bp-{w}-admin.png}` per width; a sha256 collision group passes only if its filenames are exactly that pair for a single width. All other collisions fail the harness.
- **D-20:** **Multi-category MISS branch is treated identically to Performance MISS** — `audit-mobile.sh` already fails any category below threshold (Perf 90, A11y 95, BP 95, SEO 90) per `.planning/closure/audit-mobile.sh:54-58`. The outcome wording uses "N/5 routes under threshold" rather than "N/5 routes under 90" so the same MISS branch covers Perf and non-Perf failures. Evidence file MUST name the specific failing category per route in the score table so the follow-up trigger is actionable.
- **D-21:** **Plan paths are repo-relative** (vs absolute `/Users/khaiphan/code/wtcs-community-polls/...`). The active execute environment may be a worktree under `.claude/worktrees/...` or the main checkout — absolute paths drift between checkouts. All `<read_first>` and `<files>` blocks use `.planning/...`, `src/...`, `e2e/...` paths rooted at the repo top.
- **D-22:** **Plan 13-02 `<verify>` inspects existing reports — never re-invokes `audit-mobile.sh`.** D-13 single-run policy means the audit produces one set of `.report.json` files in `.planning/closure/artifacts/lighthouse/`. Verification reads those JSON files with `jq` (e.g., `jq '.categories.performance.score * 100 | floor' lh-mobile-home.report.json`) instead of re-running Lighthouse. Re-running would change official scores.
- **D-23:** **Fixture wording = "inline mirrored from `e2e/fixtures/test-users.ts`"** (vs "imported"). The harness is `.mjs` and the fixture file is `.ts` — runtime import across the type boundary is rejected by Node's loader. The harness inlines the UUID and email literal, with an inline source-comment citing `e2e/fixtures/test-users.ts:21-30` so future maintainers know where the canonical values live. Pattern matches the existing `ADMIN_FIXTURE` declaration at `.planning/closure/audit-screenshots.mjs:53-56`.
- **D-24:** **Plan-N-SUMMARY.md files are NOT in `files_modified` and NOT committed atomically.** The atomic Phase 9 Path-3 commit covers the artifacts that ship the closure (harness + evidence + PROJECT.md + REQUIREMENTS + MANIFEST). Plan summaries are post-execution operator notes generated by `/gsd-execute-phase`'s normal summary flow — they live in `.planning/phases/13-…/` and ship in a separate `docs(13): ship summaries` commit if at all. The `<output>` block of each PLAN.md keeps the SUMMARY requirement but no longer claims atomic-commit inclusion.
- **D-25:** **No `GitHub PR #XX` placeholder in committed text.** The evidence file's v1.2 Rerun section omits the PR reference at commit time; the operator may add it post-merge in a documentation follow-up commit. Avoids stale-placeholder rot.
- **D-26:** **Acknowledge "technical miss" in evidence on a 89 outcome** (Gemini LOW). If any route lands at exactly 89 Perf, the evidence file's v1.2 Rerun § Lighthouse mobile scores notes "technical miss within Lighthouse ±5-10pp noise band; follow-up trigger is the next perf-budget change, not a same-deploy rerun (D-13 single-run policy)." Wording is identical regardless of which specific route lands at 89.

### Evidence file shape (Area 4)
- **D-15:** **Append `## v1.2 Rerun (2026-05-XX)` section to existing `.planning/closure/UIDN-02-mobile-evidence.md`** (vs new file, vs split with PROJECT.md stat block). Single source of truth; full audit history in one file; mirrors how `OBSV-02-bundle-delta.md` grows over time.
- **D-16:** **Frontmatter `status` convention = `complete-v1.2` (pass) / `deferred-v1.2` (miss).** Carries the milestone tag so future readers know which audit cleared.
- **D-17:** **PROJECT.md Key Decisions row update wording mirrors Phase 9 convention with v1.2 tag and inline path to evidence.** Pass: `✓ Good (v1.2 — Lighthouse Perf 5/5 ≥ 90; see .planning/closure/UIDN-02-mobile-evidence.md § v1.2 Rerun)`. Miss: `⚠️ Revisit (v1.2 rerun — N/5 routes under 90; follow-up tied to next perf-budget change; see .planning/closure/UIDN-02-mobile-evidence.md § v1.2 Rerun)`.
- **D-18:** **v1.2 section adds only NEW cross-refs** (Phase 13 CONTEXT/PLAN, harness diff, Phase 12 prod commit `de15e33`). v1.1 baseline cross-refs (Phase 9 D-03/D-05/D-06, F1/F2/F6, audit harness paths) are inherited above and not duplicated.

### Claude's Discretion
- **Exact harness diff line count** — sentinel + dupe-check additions land at the planner's chosen line locations; preserve the warning-only philosophy on per-PNG probes.
- **Commit/PR shape** — single atomic commit vs WAVE-1 (harness fix + dupe-check) + WAVE-2 (rerun + evidence + PROJECT.md row) is planner's call. Phase 9 Path-3 pattern says "atomic" — likely one commit, but planner verifies that the rerun output (which depends on the harness fix) doesn't force a split.
- **MANIFEST.json prune logic for the dropped Pass-A `/topics` + `/archive` entries** — planner verifies the existing rm/upsert flow at `audit-screenshots.mjs:198-228` cleanly handles the route removal (stale entries should be pruned by the existing `rm -rf ARTIFACTS_DIR` at line 61 + the manifest upsert).
- **Pass-B context cleanup ordering** — two contexts means `await context.close()` for each (admin context closes after `/admin/*` loop, member context closes after `/topics + /archive` loop). Planner picks loop structure (sequential vs context-per-route).
- **Exact memberUser fixture is `11111111-1111-1111-1111-111111111111`** — confirmed in `e2e/fixtures/test-users.ts:21-24`; planner imports the constant rather than hardcoding the UUID literal.
- **Sign-off paragraph wording** — italics-form (matches Phase 9 baseline + OBSV-02 convention). Planner drafts; final text reviewed in PR.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements (locked)
- `.planning/REQUIREMENTS.md` § "Active (v1.1 — Hygiene & Polish)" — **UIDN-02** active row (line 31): locks "(1) `audit-screenshots.mjs` hydration-wait fix (Plan 02 defect — `waitForLoadState('networkidle')` plus authenticated Pass-A for `/topics` and `/archive` using existing `loginAs` from `e2e/helpers/auth.ts`); (2) v1.2 production deploy stabilizes perf budget."
- `.planning/REQUIREMENTS.md` § "Phase Traceability" line 74 — **UIDN-02 → Phase 13 → Pending.**
- `.planning/ROADMAP.md` § "Phase 13: UIDN-02 Mobile Audit Closure" — **4 success criteria locked.** SC1 = harness fix; SC2 = auth Pass-A; SC3 = Lighthouse score for all 5 routes archived; SC4 = row flip ⚠️ → ✓ if Perf ≥ 90 on all 5 routes, else document delta + ⚠️ stays.

### Phase 9 closure decisions (carry-forward)
- `.planning/closure/UIDN-02-mobile-evidence.md` — v1.1 baseline evidence file (status: deferred). The full v1.1 method, scores, F6 warning corpus, and Sign-off ALL stay as-is; the v1.2 rerun appends a new section below per D-15.
- `.planning/closure/UIDN-02-mobile-evidence.md` § "Method" — locks Lighthouse 13.2.0 + Playwright 1.59.1; flags `--form-factor=mobile --throttling-method=simulate --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless=new --no-sandbox"`.
- `.planning/phases/09-ui-closure-evidence/09-CONTEXT.md` — **D-03** (audit target = prod), **D-05** (5-route Lighthouse set), **D-06** (`/admin` row uses unauth redirect-followed score), **F1/Decision A** (sha256 MANIFEST committed; binaries gitignored), **F2 hard gate** (zero failed Lighthouse routes AND zero F6 warnings), **F6 warning-only philosophy** (per-PNG DOM/path probe; capture continues on miss), **F7** (clean prior-run artifacts), **Path-3 atomic-commit pattern** (row flip + evidence + script fix lands together), **Pitfall 1** (single-run policy with ±5–10pp variance band), **Pitfall 4** (`setViewportSize` BEFORE `goto`).
- `.planning/phases/09-ui-closure-evidence/09-RESEARCH.md` — **Pattern 2 Option A** (auth screenshots against local preview build; D-07/D-08 explicitly reuses this), **Pitfall 5** (probe local server before doing anything else), **D-14 ship-anyway analog** (NOT applied this phase per D-11), **/admin redirect documentation** (resolves Open Q #2).
- `.planning/closure/OBSV-02-bundle-delta.md` — closure-evidence shape analog (italics-form Sign-off, frontmatter, method/results/cross-refs/sign-off layout). v1.2 Rerun section follows the same convention.

### Harness scripts (modified by Phase 13)
- `.planning/closure/audit-screenshots.mjs` — Playwright harness; sentinel insertion sites at lines 80 and 161 (current PR #24 `body.filter` waitFor); Pass-B `AUTH_ROUTES` array at lines 41-46 grows from 2 to 4 entries; new `signInWithPassword` second context for memberUser; new sha256 dupe-check block at end before existing MANIFEST upsert at lines 198-228.
- `.planning/closure/audit-mobile.sh` — Lighthouse harness; UNCHANGED for Phase 13. Single-run policy honored.
- `.planning/closure/artifacts/MANIFEST.json` — sha256-pinned record committed; binary PNGs and Lighthouse reports stay gitignored. The new dupe check reads sha256 directly from the harness's in-memory hash, not from the manifest (manifest write happens after the check).

### Auth + fixtures
- `e2e/helpers/auth.ts:71-114` — `loginAs(page, fixtureUserId)` helper. Pattern reused inline in audit-screenshots.mjs Pass-B (already at lines 122-149 for adminUser; D-08 adds a parallel block for memberUser).
- `e2e/fixtures/test-users.ts:21-30` — `fixtureUsers.adminUser.id = '22222222-…'` and `fixtureUsers.memberUser.id = '11111111-…'`. Planner imports these constants rather than hardcoding UUIDs.
- `e2e/fixtures/test-users.ts:49` — `FIXTURE_PASSWORD` shared sentinel; already used by audit-screenshots.mjs.

### Sentinel target
- `src/components/layout/Navbar.tsx:74-80` — DropdownMenu trigger Button with `aria-label="Toggle color theme"`. Unconditional render (outside the `{user ? ... : ...}` ternary at line 98). The sentinel target locked by D-03.
- `src/routes/__root.tsx:27` — `<Navbar />` mounted unconditionally inside RootLayout, so the sentinel is present on every route including `/auth/error`.

### Project artifacts (touched by Phase 13)
- `.planning/PROJECT.md` § Key Decisions row "Mobile-first responsive design" (currently line 211) — wording update per D-17 (pass or miss variant).
- `.planning/REQUIREMENTS.md` § "Active (v1.1 — Hygiene & Polish)" UIDN-02 row (currently line 31) — wording update to record v1.2 outcome and follow-up trigger per D-14.
- `.planning/REQUIREMENTS.md` § "Phase Traceability" line 74 — flip "Pending" → "Complete (Phase 13, 2026-05-XX)" or "Active (Phase 13 v1.2 rerun complete; pending next perf-budget change)" depending on outcome.

### Prior phase context (carry-forward)
- `.planning/phases/12-admin-ui-user-ui-uidn-03-sweep/12-CONTEXT.md` — Phase 12 shipped UIDN-03 sweep + VIS schema additions; merge commit `de15e33` is the v1.2 production deploy that v1.2 rerun audits against. No Phase 12 D-decision constrains Phase 13.
- `.planning/STATE.md` — current focus = Phase 13; v1.2 progress 2/3 phases complete; UIDN-02 explicitly listed as the remaining ⚠️ pending row.

### Codebase patterns to mirror
- Project source-comment policy — **WHY-only, no review-round / phase-ID archaeology in `src/`**. The harness lives under `.planning/closure/` (NOT `src/`), so plan-ID inline comments are acceptable there per Phase 9 precedent.
- Closure-evidence Sign-off italics convention — Phase 9 baseline `*Audited: ... against ...* / *Method: ...* / *Disposition: ...*` pattern. v1.2 Rerun section ends with the same italics shape.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`audit-screenshots.mjs` Pass-B infrastructure** (lines 100-180) — the existing `signInWithPassword` + `addInitScript` block for adminUser is a copy-paste template for the new memberUser context (D-08). Same SUPABASE_URL, same FIXTURE_PASSWORD, same STORAGE_KEY derivation.
- **MANIFEST.json sha256 build path** (lines 198-228) — already computes sha256 per PNG. The new dupe-check (D-05) reuses the same sha256 values; planner can either compute once and reuse, or compute twice and verify (negligible cost either way).
- **Phase 9 F6 warning-only DOM/path probe** (lines 87-94 Pass-A, lines 168-175 Pass-B) — kept as-is. The new sentinel waitFor + sha256 dupe-check are deterministic backstops; the per-PNG warnings stay informational.
- **`audit-mobile.sh` lighthouse pipeline** — UNCHANGED for Phase 13. The script-fix work is scoped to audit-screenshots.mjs only.
- **Navbar `[aria-label="Toggle color theme"]`** (`src/components/layout/Navbar.tsx:76`) — sentinel target. Already exists; no `src/` edit needed.

### Established Patterns
- **Phase 9 zero-src/-edits closure invariant** — Phase 13 maintains it. The deterministic sentinel uses an EXISTING aria-label, NOT a new attribute. Confirmed via D-02.
- **Phase 9 atomic-commit Path-3 pattern** — harness fix + evidence update + PROJECT.md row + REQUIREMENTS update all land together. Planner picks single commit vs WAVE-split (likely single).
- **Phase 9 single-run policy (Pitfall 1)** — Lighthouse runs once per route. Distinct from screenshot-harness gates which can be iteratively debugged.
- **Phase 9 italics Sign-off** — `*Audited: ... against ...* / *Method: ...* / *Disposition: ...*` ending. v1.2 Rerun section follows this.

### Integration Points
- **`audit-screenshots.mjs` Pass-A unauth route array** (lines 28-40) — drop `/topics` and `/archive` entries per D-09. `/admin` stays per Phase 9 D-06.
- **`audit-screenshots.mjs` Pass-B auth route array** (lines 41-46) — grows from 2 to 4 entries; planner splits the loop into two contexts (admin context + member context) per D-08.
- **`audit-screenshots.mjs` end-of-file** — new sha256 dupe-check block lands BEFORE the existing MANIFEST upsert (so the harness exits non-zero before writing a manifest from a known-bad run). Planner picks: write manifest anyway for forensics, or skip manifest write on dupe-fail.
- **`.planning/closure/UIDN-02-mobile-evidence.md`** — append new `## v1.2 Rerun (2026-05-XX)` section per D-15. Frontmatter status field updated per D-16.
- **`.planning/PROJECT.md` Key Decisions table** — single row update per D-17.
- **`.planning/REQUIREMENTS.md`** — UIDN-02 active row + Phase Traceability row, both updated per D-14.

</code_context>

<specifics>
## Specific Ideas

- **User-chosen strengthen-with-deterministic-sentinel over trust-as-is** (A1-D1) — PR #24's text-filter waitFor was added but never validated; relying on text-shape is too fragile.
- **User-chosen existing aria-label sentinel over `data-app-ready` attribute** (A1-D2/D3) — preserves the Phase 9 zero-src/-edits closure invariant; sentinel selector lives only in the harness.
- **User-chosen soft 10s + .catch + sha256 dupe-check backstop** (A1-D4/D5) — combines warning-only philosophy on per-PNG probes with deterministic loading-shell detection at the run level.
- **User-chosen uniform sentinel + dupe-check across all 42 PNGs** (A1-D6) — single coherent strategy, no special-casing.
- **User-chosen Pass-B 4-route extension over Pass-C-against-prod-OAuth** (A2-D7) — REUSE local infrastructure; OAuth-against-prod was already rejected by Phase 9 RESEARCH.
- **User-chosen memberUser-for-/topics+/archive split into 2 Playwright contexts** (A2-D8) — captures the REAL voter UI, not admin-as-voter.
- **User-chosen drop unauth /topics + /archive from Pass-A** (A2-D9) — eliminates by-design dupes that would false-positive the new sha256 check; preserves /admin unauth per Phase 9 D-06.
- **User-chosen plain naming over auth- prefix** (A2-D10) — no collision possible after the drop; consistent with existing Pass-B PNGs.
- **User-chosen strict-90-floor over D-14-ship-anyway** (A3-D11) — Phase 9 already used D-14 once; reapplying it would be negotiated-pass, not rigorous evidence.
- **User-chosen "next perf-budget change" follow-up trigger over v1.3-calendar** (A3-D12) — concrete trigger, not open-ended.
- **User-chosen single-run audit policy honored** (A3-D13) — Phase 9 Pitfall 1 carries forward.
- **User-chosen two-surface follow-up durability (evidence Sign-off + REQUIREMENTS row)** (A3-D14) — without inflating the requirement set with PERF-FOLLOWUP-01.
- **User-chosen append-section over new file** (A4-D15) — single source of truth; mirrors OBSV-02-bundle-delta.md's growth pattern.
- **User-chosen `complete-v1.2` / `deferred-v1.2` frontmatter status** (A4-D16) — milestone-tagged so future readers know which audit cleared.
- **User-chosen Phase 9 row-wording convention with v1.2 tag and inline path** (A4-D17) — clickable in IDE, evidence one click away.
- **User-chosen v1.2-section-adds-only-new-refs over re-list** (A4-D18) — no duplication; baseline owns the v1.1-era refs.

</specifics>

<deferred>
## Deferred Ideas

- **PERF-FOLLOWUP-01 first-class requirement row** — explicitly rejected per A3-D14 (two-surface durability via existing UIDN-02 row + evidence Sign-off is sufficient). Revisit only if perf becomes a recurring theme across multiple milestones.
- **Multi-run Lighthouse averaging / two-run sanity check** — explicitly rejected per A3-D13 (Pitfall 1 single-run policy honored). Revisit only if Lighthouse score volatility becomes a documented issue across multiple closures.
- **D-14 ship-anyway analog re-application** — explicitly rejected per A3-D11. Revisit only if a future audit lands at 89 with a strong rationale that meaningfully differs from "noise band."
- **`data-app-ready` attribute on body via main.tsx useEffect** — explicitly rejected per A1-D2 (preserves the Phase 9 zero-src/-edits closure invariant). Revisit if the Navbar aria-label sentinel proves unreliable across multiple reruns.
- **Auth-`/admin` Lighthouse audit against prod** — explicitly rejected per A2-D7 + Phase 9 D-06 (impossible without fixture seed; redirect-followed score is the locked evidence shape). Revisit only if a fixture-seed-on-prod tooling story emerges.
- **`auth-` filename prefix for auth captures** — rejected per A2-D10 (no collision after the unauth drop). Revisit if filenames ever collide again.
- **New file UIDN-02-mobile-evidence-v1.2.md** — rejected per A4-D15 (append-in-place wins). Revisit only if the file grows unwieldy across multiple version reruns.
- **Cross-ref appendix refactor** — rejected per A4-D18 (overkill for two-version history). Revisit if a third audit version lands.
- **Verbose 5-score row update wording in PROJECT.md** — rejected per A4-D17 (table wraps awkwardly on narrow terminals). Revisit if dashboard surfaces ever consume PROJECT.md programmatically.
- **CI integration of the dupe check / closure harness** — out of scope; Phase 13 ships harness fix + rerun, not CI wiring.

</deferred>

---

*Phase: 13-uidn-02-mobile-audit-closure*
*Context gathered: 2026-05-13*
