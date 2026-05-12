---
phase: 12-admin-ui-user-ui-uidn-03-sweep
plan: 01
subsystem: ui-search-bar
tags:
  - uidn-03
  - shadcn
  - search
  - ui-polish
requirements-completed:
  - UIDN-03 (1 of 4 sites; SearchBar.tsx:22)
dependency-graph:
  requires:
    - "shadcn Button primitive (src/components/ui/button.tsx, already vendored)"
  provides:
    - "SearchBar with shadcn Button clear-X (UIDN-03 D-15)"
  affects:
    - "src/components/suggestions/SearchBar.tsx (sole touched file)"
tech-stack:
  added: []
  patterns:
    - "shadcn Button variant=\"ghost\" size=\"icon\" with className size-8 sizing override for h-10 Input visual alignment"
key-files:
  created: []
  modified:
    - "src/components/suggestions/SearchBar.tsx"
decisions:
  - "Picked size-8 (32×32px) override over shadcn icon default h-9 w-9 per UI-SPEC §4a sizing guidance — better visual fit against h-10 Input content area"
  - "Dropped manual text-muted-foreground / hover:text-foreground / transition-colors classes — ghost variant inherits hover:bg-accent hover:text-accent-foreground tokens automatically (D-15 visual upgrade, not regression)"
  - "Import order: lucide-react (third-party) → Button + Input (both @/components/ui/*) grouped; alphabetical within the local group"
metrics:
  duration: "1m 32s"
  completed: "2026-05-12T21:12:28Z"
  tasks-completed: 1
  tasks-total: 1
  files-modified: 1
  files-created: 0
  commits: 1
---

# Phase 12 Plan 01: SearchBar shadcn Button Migration Summary

Replaced the native `<button>` clear-X at `src/components/suggestions/SearchBar.tsx:22` with shadcn `<Button variant="ghost" size="icon">` per UIDN-03 audit footnote [b] / closure decision D-15 — closing 1 of the 4 locked Phase 12 native-button drift sites with zero behavioral regression and an arguably-improved hover surface (background fill + icon color vs icon-color-only).

## Outcome

- One UIDN-03 site closed (`SearchBar.tsx:22`).
- Behavior zero-delta: `type="button"`, `onClick={() => onChange('')}`, `aria-label="Clear search"`, and the surrounding `{value && (...)}` show/hide rule all preserved verbatim.
- Visual: equal-or-better. Idle color inherits foreground tokens via ghost variant; hover now applies `hover:bg-accent hover:text-accent-foreground` (the standard shadcn ghost-icon hover) instead of an icon-only color shift. The clear-X stays absolutely positioned at the right edge of the `relative w-full` Input wrapper.
- ESLint: `npm run lint` exits 0 (no warnings).
- TypeScript: `npx tsc -b` exits 0.
- Pre-commit lefthook chain (`eslint --max-warnings 0` + `tsc -b --noEmit`) ran on the commit and passed.

## Implementation Summary

Single-file diff, three localized changes inside `src/components/suggestions/SearchBar.tsx`:

1. **Import added.** `import { Button } from '@/components/ui/button'` inserted between the existing `lucide-react` (third-party) and `@/components/ui/input` (local) imports. The two local imports stay alphabetical (`button` before `input`).
2. **Element migrated.** The `<button>...</button>` block on lines 21-29 became `<Button variant="ghost" size="icon" type="button" onClick={...} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 size-8"><X className="size-4" /></Button>`.
3. **Classname slimmed.** Dropped `text-muted-foreground hover:text-foreground transition-colors` — those concerns are now owned by the ghost variant (and the Button base utility chain in `cva`).

The `size-8` className override sits alongside `size="icon"` (which would otherwise resolve to `h-9 w-9`); className wins because `cn(buttonVariants({ variant, size, className }))` merges `className` last via `tailwind-merge`, so the more-specific size-8 wins the height/width race. This matches UI-SPEC §4a guidance: shadcn default icon size is taller than the h-10 Input content area at the same vertical center, so a 32px button is the leading candidate.

No other files were edited. No other lines in SearchBar.tsx were touched (Search lucide icon, Input wrapper, conditional render, prop types — all unchanged).

## Verification Performed

- `! grep -E '^\s*<button' src/components/suggestions/SearchBar.tsx` — no native `<button>` (PASS)
- `grep -q 'variant="ghost"'` — PASS
- `grep -q 'size="icon"'` — PASS
- `grep -q 'aria-label="Clear search"'` — PASS (E2E selector continuity)
- `grep -q "from '@/components/ui/button'"` — PASS
- `npm run lint` → exit 0
- `npx tsc -b` → exit 0
- Pre-commit lefthook ran `eslint --max-warnings 0 --no-warn-ignored` and `tsc -b --noEmit` against the staged change — both passed.
- Post-commit deletion check — no deletions (single-file modification).
- Post-commit untracked-file check — none.

## Deviations from Plan

None — plan executed exactly as written.

The plan offered Claude's discretion on `size-8` vs the shadcn default `h-9 w-9` if the visual misaligned in dev preview. I followed the plan's default-first recommendation (`size-8`) without invoking the fallback; the change is purely static and the existing `top-1/2 -translate-y-1/2` centering math handles both sizes correctly relative to the `h-10` Input.

## Authentication Gates

None encountered.

## Known Stubs

None. The change replaces one rendered primitive with another; no placeholders introduced, no empty data sources, no TODOs added.

## Threat Flags

None. Per the plan's threat model, this is a pure presentational refactor — same element role (button), same behavior, same accessibility surface. No new trust boundaries, no new network paths, no new schema or RLS surface. T-12-01-01/02/03 all dispositioned `accept`.

## Commits

| Task         | Commit  | Files                                       |
| ------------ | ------- | ------------------------------------------- |
| 12-01-01     | aad4fdc | src/components/suggestions/SearchBar.tsx    |

## Follow-ups (out of scope for Plan 01)

- **Plan 02** — SuggestionForm.tsx:140 + :163 → TanStack `<Link to='/admin'>` (D-14, two sites)
- **Plan 05** — ImageInput.tsx:108 → extract `<DropZone>` + inner Button variant=outline (D-13)
- Closing all three remaining sites within Phase 12 flips the `shadcn/ui new-york + Tailwind CSS v4` PROJECT.md Key Decision row from ⚠️ Revisit → ✓ Good.

## Self-Check: PASSED

- File `src/components/suggestions/SearchBar.tsx` — FOUND on disk; final content verified via `git show HEAD:src/components/suggestions/SearchBar.tsx`.
- Commit `aad4fdc` — FOUND in `git log` on branch `worktree-agent-a339c698f7ab00c5f`.
- Grep claims (`variant="ghost"`, `size="icon"`, `aria-label="Clear search"`, Button import, no native `<button>`) — all re-verified post-commit.
