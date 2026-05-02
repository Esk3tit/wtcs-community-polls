---
phase: 07-observability-hardening
plan: 03
subsystem: observability
tags: [sentry, sourcemap, bundle-delta, verification, closure, deploy-preview]

# Dependency graph
requires:
  - phase: 07-01
    provides: src/main.tsx createRoot tagged-handler factories + Sentry.init env coalesce + vite.config.ts keepNames + netlify.toml VITE_NETLIFY_CONTEXT export
  - phase: 07-02
    provides: src/routes/[__smoke].tsx env-gated route + src/components/debug/RenderThrowSmoke.tsx render-phase throw canary

provides:
  closure_records:
    - "07-VERIFICATION.md (12-section closure record — 5/5 ROADMAP success criteria PASS, both REQ rows flipped to ✅, all 4 D-08 evidence rows pinned)"
    - ".planning/closure/OBSV-02-bundle-delta.md (3-way build comparison; keepNames-only delta +6.24% gzip — over the 1.5% target; D-14 ship-anyway policy applied with rationale)"
  artifacts:
    - "artifacts/.gitkeep (D-10 directory shell)"
    - "artifacts/sentry-event.json (full Sentry envelope intercepted via Playwright MCP — release 72481f0 + b9afb99 fresh re-verification post-validateSearch hotfix; mechanism.type 'auto.function.react.error_handler' PRIMARY pass + 'generic' belt companion; environment 'deploy-preview'; tags.boundary 'app-root'; un-mangled stack frames)"
    - "artifacts/sentry-componentstack.png (live AppErrorFallback render on deploy preview)"
    - "artifacts/sourcemap-names-excerpt.txt (jq extraction of sourcemap names[] arrays — 59 unique 5+-char PascalCase identifiers)"
    - "artifacts/__name-grep.txt (Round-4 amended Rolldown-correct mechanical evidence — literal `function Name(...)` declaration grep replaces the original esbuild `__name(` helper-grep that empirically returns 0 on Rolldown)"

affects:
  - "ROADMAP.md (Phase 7 plans 1+2+3 all checked; Phase 7 Goal Achievement closes; Round-4 amendment to SC #3)"
  - "src/routes/[__smoke].tsx (Round-4 hotfix — validateSearch String coerce so bare ?render=1 triggers the throw)"
  - "vite.config.ts (Round-4 amended explanatory comment for Rolldown keepNames mechanism)"
  - ".planning/phases/07-observability-hardening/{07-03-PLAN,07-CONTEXT,07-RESEARCH,07-VALIDATION,07-PATTERNS}.md (Round-4 plan amendments — `__name(` esbuild-idiom assertion replaced with Rolldown-correct literal-function-declaration assertion)"
  - ".planning/research/v1.1-VITE-SOURCEMAPS.md (Round-4 banner correcting the original `__name(` helper claim)"

# Tech tracking
tech-stack:
  added: []  # No new deps — closure/verification work only
  patterns:
    - "Playwright MCP intercept of Sentry envelope POST as a deploy-preview verification surface (replaces Sentry-UI screenshot dependency for D-08 evidence; also captures the un-mangled stack frames + componentStack inline so the artifact is self-contained without requiring Sentry account access)"
    - "3-way same-session git-worktree build comparison for clean per-flag bundle-delta attribution (Round-2 MEDIUM-3 pattern; main / phase-7-without-keepNames / phase-7-with-keepNames; gzip values sourced from Vite printed per-chunk column per Round-3 LOW-4 single-source-of-truth)"
    - "Rolldown keepNames mechanism is literal-function-declaration preservation (Round-4 empirical correction — Rolldown does NOT emit esbuild's `__name(fn,'orig')` helper; verify via `grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke)\\b' dist/assets/*.js`)"

key-files:
  created:
    - ".planning/phases/07-observability-hardening/07-VERIFICATION.md"
    - ".planning/closure/OBSV-02-bundle-delta.md"
    - ".planning/phases/07-observability-hardening/artifacts/.gitkeep"
    - ".planning/phases/07-observability-hardening/artifacts/sentry-event.json"
    - ".planning/phases/07-observability-hardening/artifacts/sentry-componentstack.png"
    - ".planning/phases/07-observability-hardening/artifacts/sourcemap-names-excerpt.txt"
    - ".planning/phases/07-observability-hardening/artifacts/__name-grep.txt"
  modified:
    - "src/routes/[__smoke].tsx (Round-4 hotfix: validateSearch String coerce)"
    - "vite.config.ts (Round-4 amended Rolldown keepNames mechanism comment)"
    - ".planning/ROADMAP.md (SC #3 Round-4 amendment)"
    - ".planning/phases/07-observability-hardening/{07-03-PLAN,07-CONTEXT,07-RESEARCH,07-VALIDATION,07-PATTERNS}.md (Round-4 plan amendments)"
    - ".planning/research/v1.1-VITE-SOURCEMAPS.md (Round-4 banner)"

key-decisions:
  - "D-14 ship-anyway policy applied to keepNames-only bundle delta: measured +6.24% gzip vs the 1.5% target. Triage cost of mangled Sentry stack frames > +22.68 kB gzip on a $0/mo Netlify legacy free-tier deploy. No CI bundle-size gate exists in v1.1 (deferred to v1.2 per ROADMAP). Documented rationale in OBSV-02-bundle-delta.md."
  - "Round-4 hotfix shipped within Plan 03: validateSearch String-coerce fix to src/routes/[__smoke].tsx so bare /__smoke?render=1 (the URL the docs cite) triggers the throw. TanStack Router's default search parser JSON-parses `1` as a number, so the original strict `=== '1'` (string) compare always failed."
  - "Round-4 plan amendment shipped within Plan 03: 8 docs + 1 vite.config.ts comment updated to use Rolldown-correct `grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke)\\b'` literal-function-declaration assertion instead of the original esbuild-idiom `grep '__name('` check (which empirically returns 0 on Rolldown despite working symbolication)."
  - "D-08 manual evidence captured via Playwright MCP intercepting the Sentry envelope POST in flight, NOT via Sentry UI screenshots. Substantively equivalent — same mechanism.type, environment, tags, exception.value, and stack frames as the Sentry UI would show — and self-contained in artifacts/ without requiring Sentry account access for review."
  - "Round-3 LOW-2 temp-worktree pattern was unnecessary for the inspection build (release SHA == HEAD with clean tree). Recorded as in-tolerance deviation in 07-VERIFICATION.md Evidence #4."

patterns-established:
  - "Plan 03 closure plan that captures live deploy-preview evidence via browser automation tooling (Playwright MCP) rather than Sentry-UI screenshots — avoids the screenshot/credential dependency and produces machine-readable artifacts (sentry-event.json) that future verifiers can re-parse"
  - "Closure-evidence directory convention: `.planning/closure/<REQ-ID>-<topic>.md` with frontmatter (requirement, measured, target_pct, actual_pct, status) — first instance under .planning/closure/, sets the pattern for v1.1 UIDN-02 / UIDN-03 closure evidence in Phase 9"
  - "Round-4 amendment block convention: when empirical findings during execution invalidate a plan assumption, prepend a short amendment table to the plan doc + update the inline assertions + add a clarifying note at top of relevant research files. Preserves traceability without rewriting history."

requirements-completed: [OBSV-01, OBSV-02]

# Metrics
duration: ~90min (Task 1 evidence capture + 2 finding fixes round-trip + Task 2 + Task 3)
completed: 2026-04-30
---

# Phase 07 Plan 03: D-08 Evidence Capture + Closure Records Summary

**The Phase 7 capture path (OBSV-01) and symbolication (OBSV-02) are end-to-end verified on the PR #21 Netlify deploy preview; both requirements close with the canonical Sentry event at `https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/`. Two Round-4 amendments shipped within this plan: validateSearch String-coerce hotfix + Rolldown keepNames doc correction across 8 files. D-14 ship-anyway policy applied to the +6.24% keepNames-only bundle delta (triage gain >> bandwidth cost on a $0/mo project).**

## Performance

- **Duration:** ~90 min including the round-trip on the two findings (validateSearch fix push → wait for Netlify rebuild → re-verify on b9afb99)
- **Completed:** 2026-04-30
- **Tasks:** 3 (Task 1 human-action via Playwright MCP intercept; Task 2 + Task 3 inline)
- **Files created:** 7 (07-VERIFICATION.md + OBSV-02-bundle-delta.md + .gitkeep + 4 evidence artifacts)
- **Files modified:** 8 (Round-4 amendments) + 2 (Round-4 code/config)

## Accomplishments

1. **Live D-08 evidence captured** on PR #21 Netlify deploy preview via Playwright MCP intercepting the Sentry envelope POST in flight. Full envelope JSON (with all 4 D-08 evidence components — componentStack, un-mangled frames, mechanism, environment, tags, exception value) committed to `artifacts/sentry-event.json` for self-contained verification.
2. **Sentry permalink pinned** in `07-VERIFICATION.md`: `https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/` — release `72481f0`, env `deploy-preview`, mechanism `auto.function.react.error_handler` (PRIMARY pass per Round-2 MEDIUM-1) + `generic` belt companion (expected per Round-2 MEDIUM-1 secondary observation).
3. **`07-VERIFICATION.md` written** following the 12-section structural template from `06-VERIFICATION.md`, scaled to Phase 7's 5 ROADMAP success criteria + 7 required artifacts. Frontmatter: `phase: 07-observability-hardening`, `verified: 2026-04-30T09:42:27Z`, `status: passed`, `score: 5/5 roadmap success criteria verified`, `overrides_applied: 0`. All 4 D-08 evidence rows + Round-2 LOW-2 fifth row populated with real values; no `<placeholder>` tokens remain.
4. **3-way same-session bundle-delta build comparison** completed (W1 main / W2 phase-7-without-keepNames via surgical sed revert / W3 phase-7-with-keepNames as-shipped). Results captured in `.planning/closure/OBSV-02-bundle-delta.md` with frontmatter (requirement, measured, target_pct=1.5, actual_pct=6.24, status=over-target), Method paragraph, Total gzip table, top-25 per-chunk delta table, and D-14 ship-anyway rationale (5 bullet points).
5. **Round-4 hotfix shipped within this plan:** `src/routes/[__smoke].tsx` `validateSearch` switched from strict `=== '1'` (broken because TanStack's default search parser JSON-parses `1` as a number) to `String(search.render) === '1'`. End-to-end re-verified on deploy preview `b9afb99` — bare `?render=1` triggers the throw (TanStack auto-canonicalizes URL to `?render=%221%22` post-validate).
6. **Round-4 plan amendment shipped within this plan:** 8 docs + 1 vite.config.ts comment updated to use Rolldown-correct `grep -lE 'function (RootLayout|AppErrorFallback|RenderThrowSmoke)\b' dist/assets/*.js | wc -l >= 1` literal-function-declaration assertion instead of the original esbuild-idiom `grep '__name(' >= 1` check. Empirically `__name(` returns 0 on Rolldown despite working symbolication; the literal-function-declaration grep is the Rolldown-correct mechanical proof and what Sentry's stack-frame reading actually relies on.

## Task Commits

Plan 03 was executed inline (Pattern C) due to the human-action checkpoint at Task 1 + the user-directed Round-4 hotfix workflow. Atomic commits will land alongside this SUMMARY:

| Task | Title | Status |
|------|-------|--------|
| 1 | Capture D-08 evidence on Phase 7 PR #21 Netlify deploy preview (manual via Playwright MCP intercept) | complete (artifacts in `artifacts/`) |
| 2 | Write 07-VERIFICATION.md following the 06-VERIFICATION.md 12-section template | complete (`07-VERIFICATION.md`) |
| 3 | Run 3-way same-session build comparison + write OBSV-02-bundle-delta.md | complete (`.planning/closure/OBSV-02-bundle-delta.md`) |

## Files Created/Modified

### Created
- `.planning/phases/07-observability-hardening/07-VERIFICATION.md` — 12-section closure record
- `.planning/closure/OBSV-02-bundle-delta.md` — first instance under `.planning/closure/`; establishes the v1.1 closure-evidence pattern for Phase 9's UIDN-02/UIDN-03 evidence
- `.planning/phases/07-observability-hardening/artifacts/.gitkeep` — D-10 directory shell
- `.planning/phases/07-observability-hardening/artifacts/sentry-event.json` — full intercepted Sentry envelope with all D-08 evidence components inline + Round-4 known-bug + permalink + workaround context
- `.planning/phases/07-observability-hardening/artifacts/sentry-componentstack.png` — live AppErrorFallback render screenshot from deploy preview (non-Sentry-UI evidence — captured by Playwright)
- `.planning/phases/07-observability-hardening/artifacts/sourcemap-names-excerpt.txt` — jq extraction of sourcemap `names[]` arrays (59 unique 5+-char PascalCase identifiers)
- `.planning/phases/07-observability-hardening/artifacts/__name-grep.txt` — Rolldown-correct mechanical evidence + Round-4 plan-amendment context

### Modified (Round-4 hotfix + amendments)
- `src/routes/[__smoke].tsx` — validateSearch String coerce (commit `b9afb99`)
- `vite.config.ts` — explanatory comment amended to clarify Rolldown's literal-function-declaration preservation mechanism
- `.planning/ROADMAP.md` — SC #3 Round-4 amendment
- `.planning/phases/07-observability-hardening/07-03-PLAN.md` — Round-4 amendment block at top
- `.planning/phases/07-observability-hardening/07-CONTEXT.md` — D-08 row Round-4 amendment
- `.planning/phases/07-observability-hardening/07-VALIDATION.md` — 07-01-T2 row Round-4 amendment
- `.planning/phases/07-observability-hardening/07-PATTERNS.md` — Behavioral Spot-Checks + Human Verification Required rows Round-4 amended
- `.planning/phases/07-observability-hardening/07-RESEARCH.md` — banner at top noting empirical correction
- `.planning/research/v1.1-VITE-SOURCEMAPS.md` — banner at top noting empirical correction

## Decisions Made

- **D-14 ship-anyway applied to keepNames-only delta (+6.24% vs 1.5% target).** Triage cost of mangled Sentry stack frames is concrete and recurring; +22.68 kB gzip on a $0/mo Netlify free-tier deploy is functionally zero cost. Original 1.5% target was an esbuild analog from v1.1-VITE-SOURCEMAPS.md research; Rolldown's Oxc minifier mangles more aggressively than esbuild does by default, so the keepNames-vs-mangled delta is necessarily larger. Re-evaluation hook documented (only relevant if leaving Netlify legacy free tier — not on v1.2 roadmap).
- **D-08 manual evidence captured via Playwright MCP intercepting the Sentry envelope POST.** Original plan envisioned Sentry-UI screenshots; Playwright MCP intercept produces self-contained machine-readable artifacts that don't require Sentry account access for verification. Sentry-UI permalink still pinned for human re-open.
- **Round-3 LOW-2 temp-worktree pattern not used for inspection build** because release SHA == HEAD with clean tree (precondition for the temp-worktree workaround was absent). Recorded as in-tolerance deviation in 07-VERIFICATION.md Evidence #4.

## Deviations from Plan

| Deviation | Severity | Reason |
|-----------|----------|--------|
| D-08 evidence captured via Playwright MCP intercept instead of Sentry UI screenshots | low (tool substitution) | Substantively equivalent + reviewer-friendly (machine-readable JSON in repo); permalink still pinned for human re-open |
| Inspection build run in main worktree, not temp worktree (Round-3 LOW-2) | low (precondition absent) | Main worktree was already at release SHA with clean tree; temp-worktree pattern existed to handle dirty WIP — none here |
| Round-4 hotfix shipped within Plan 03 (validateSearch String coerce) | medium (in-plan code change) | Found by Task 1 verification on deploy preview; one-line fix; verified end-to-end on follow-up deploy preview before closing the plan |
| Round-4 plan amendment shipped within Plan 03 (8 docs + vite.config.ts comment for Rolldown keepNames mechanism) | medium (in-plan doc change) | Empirical finding from Task 1 — original plan assumed esbuild's `__name(` helper idiom but Rolldown does not emit it. Substantive verification still passes via the Rolldown-correct literal-function-declaration check. |

## Issues Encountered

- **Bare `?render=1` URL didn't trigger the throw on first deploy preview** (release `72481f0`). Worked around with URL-encoded `?render=%221%22`, then root-cause fixed in-plan (validateSearch String coerce). Re-verified on follow-up release `b9afb99`.
- **Plan's `__name(` keepNames assertion empirically returned 0** on Rolldown's Oxc minifier despite working symbolication. Replaced with Rolldown-correct literal-function-declaration grep across 8 docs (Round-4 amendment).

## Threat Flags

None. Phase 7 closure work is config + verification + documentation — no business-logic surface introduced. The two Round-4 in-plan changes (validateSearch String coerce + plan amendments) preserve the env-gate semantics (production still returns TanStack 404) and do not affect the threat register (T-07-05 through T-07-09 unchanged).

## User Setup Required

None. Plan 03 establishes the closure-evidence convention; downstream phases (Phase 9 UIDN-02/UIDN-03) will follow the same pattern. The Sentry event remains independently verifiable at the pinned permalink for any future maintainer.

## Self-Check: PASSED

| Gate | Status |
|------|--------|
| All 3 tasks executed | ✓ |
| 07-VERIFICATION.md exists with 12-section structure + frontmatter (`phase`, `verified`, `status`, `score`, `overrides_applied`) | ✓ |
| 07-VERIFICATION.md frontmatter uses `---` (hyphens) NOT `___` (underscores) | ✓ |
| 07-VERIFICATION.md `## Human Verification Required` carries 4 D-08 evidence rows + Round-2 LOW-2 fifth row + Round-4 amendment row | ✓ |
| All 5 ROADMAP success criteria PASS in `## Goal Achievement` | ✓ |
| Both REQ rows (OBSV-01, OBSV-02) flip from Pending → ✅ pass | ✓ |
| OBSV-02-bundle-delta.md exists with frontmatter (requirement, measured, target_pct, actual_pct, status), Method, Total table, Per-chunk table, Target check, Raw build output sections | ✓ |
| Bundle-delta uses Vite printed gzip column as single source of truth (Round-3 LOW-4) | ✓ |
| 3-way build comparison captured (W1 main / W2 no-keepNames / W3 with-keepNames) per Round-2 MEDIUM-3 | ✓ |
| Round-2 MEDIUM-1 PRIMARY mechanism criterion: at least one event with `auto.function.react.*` confirmed | ✓ (auto.function.react.error_handler observed) |
| Round-2 HIGH-1 environment tag check: NOT 'production' | ✓ (deploy-preview observed) |
| Round-2 LOW-2 exception.value matches deterministic smoke message | ✓ (exact string match) |
| Round-4 hotfix verified end-to-end on follow-up deploy preview | ✓ (release b9afb99 — bare ?render=1 triggers throw) |
| `requirements-completed: [OBSV-01, OBSV-02]` in this SUMMARY's frontmatter | ✓ |
| artifacts/.gitkeep exists | ✓ |

## Next Plan Readiness

Phase 7 is complete. ROADMAP plans 1+2+3 all checked. Both OBSV requirements close.

Next steps:
1. Run `gsd-verifier` against the full phase to validate goal achievement (orchestrator's next move).
2. Merge PR #21 once verifier passes + Netlify deploy preview is green.
3. Post-merge: confirm live prod still returns 404 on `/__smoke?render=1` (the env-gate suppresses the throw on production builds).
4. Phase 8 (E2E Test Hygiene) starts next per ROADMAP order; nothing in Phase 7 blocks it.

---
*Phase: 07-observability-hardening*
*Completed: 2026-04-30*
