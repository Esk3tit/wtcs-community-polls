---
phase: 07-observability-hardening
fixed_at: 2026-04-30T00:00:00Z
review_path: .planning/phases/07-observability-hardening/07-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 3
skipped: 1
status: all_fixed
---

# Phase 7: Code Review Fix Report (Iteration 2 — Info Sweep)

**Fixed at:** 2026-04-30
**Source review:** `.planning/phases/07-observability-hardening/07-REVIEW.md` (iteration 2, status `clean`)
**Iteration:** 2
**Scope:** `--all` (Critical + Warning + Info; review had zero CR/WR remaining, so only Info findings actioned)

**Summary:**

- Findings in scope: 4 (IN-01, IN-02, IN-04, IN-05)
- Fixed: 3 (IN-01, IN-02, IN-04)
- Skipped: 1 (IN-05 — non-actionable observation about an auto-generated file)
- Status: `all_fixed` — every actionable Info finding addressed; the lone skip is pure documentation with no mechanical fix to apply

Info findings were treated as suggestions, not bugs. Each fix is mechanical and minimal: a positive DEV-confirmation log, a tag→context shift to protect Sentry tag-key indexing, and a clarifying inline comment. No behavior changes affect production capture paths.

## Fixed Issues

### IN-01: Sentry-DSN missing-warning runs at module load only — no positive confirmation when DSN IS set

**Files modified:** `src/main.tsx`
**Commit:** `cd5b7f4`
**Applied fix:** Wrapped the existing missing-DSN warn inside an outer `if (import.meta.env.DEV)` guard and added an `else` branch that emits `console.info('[sentry] active', { env })` when the DSN is present. The env value reuses the same `VITE_NETLIFY_CONTEXT || MODE` resolution already passed to `Sentry.init`, so the dev log mirrors the actual environment label Sentry receives. No-op in production builds because the entire block is DEV-gated.

### IN-02: `eventId` as Sentry tag is non-idiomatic

**Files modified:** `src/main.tsx`
**Commit:** `c2e5277`
**Applied fix:** Inside `Sentry.ErrorBoundary`'s `onError` belt, moved `eventId` out of `tags` (where it would consume Sentry's bounded tag-key indexing budget on the free tier) into `contexts.linked_event = { eventId }`. The boundary tag stays where it belongs (`tags: { boundary: 'app-root' }`). Cross-event linking via the SDK ErrorBoundary `eventId` is preserved through the contexts dimension, which has no cardinality penalty. Verified `tsc --noEmit` clean — Sentry's `CaptureContext.contexts` accepts arbitrary string-keyed shapes.

### IN-04: `RenderThrowSmoke`'s `: never` return type is correct but visually surprising in JSX position

**Files modified:** `src/components/debug/RenderThrowSmoke.tsx`
**Commit:** `6ead026`
**Applied fix:** Added an inline comment immediately above `export function RenderThrowSmoke(): never` documenting why `: never` typechecks in JSX position (`never <: ReactNode`). Pure documentation; no code changes. Eliminates the "why doesn't this return JSX?" reaction during future reviews.

## Skipped Issues

### IN-05: `routeTree.gen.ts` is auto-generated — confirmed no manual edits

**File:** `src/routeTree.gen.ts:1-9`
**Reason:** Non-actionable observation. The reviewer explicitly notes "Fix: None — auto-generated." The finding exists only to confirm cross-file wiring of `[__smoke].tsx` into the route tree — it is a deep-mode review checkpoint, not a code defect. Editing the file would violate TanStack Router's codegen contract. No fix possible.
**Original issue:** Auto-generated file with `@ts-nocheck` header. `Char91__smokeChar93Route` symbol confirms the bracketed `[__smoke].tsx` filename was processed correctly.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` clean after each individual fix
- Pre-commit hooks (lint-staged → eslint + tsc -b) passed for every commit
- Three atomic commits, one per actionable finding, all using `chore(07): IN-NN <summary>` (info-level findings are not bugs)

## Behavior Impact

- **Production:** zero impact. IN-01 is DEV-gated, IN-04 is comment-only, and IN-02 is a metadata reshuffle within a single `captureException` call (same event reaches Sentry, same triage cross-references work, just under `contexts.linked_event` instead of a tag).
- **Sentry indexing:** IN-02 reduces tag-key cardinality growth — long-term protection of free-tier limits.
- **Developer experience:** IN-01 removes the "is Sentry on?" Network-tab inspection step; IN-04 reduces review friction on the `: never` annotation.

---

_Fixed: 2026-04-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2 (info-only sweep; iteration 1 closed all WR findings)_
