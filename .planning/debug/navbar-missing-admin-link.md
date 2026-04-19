---
status: diagnosed
trigger: "UAT Test 3: No UI entry point to /admin — admins must type the URL manually. Navbar has Topics and Archive links but no conditional admin link based on useAuth().isAdmin."
created: 2026-04-18
updated: 2026-04-18
---

## Current Focus

hypothesis: Feature omission — Phase 4 Plan 04-03 scoped the app-wide Navbar ONLY for the WTCS logo (D-03). No plan task scoped a conditional "Admin" link, so it was never implemented.
test: Read Navbar.tsx, MobileNav.tsx, AuthContext.tsx, /admin route, Plan 04-03 PLAN + SUMMARY
expecting: Confirm absent link in both surfaces, isAdmin exposed, /admin AdminGuard-gated, no Plan 04 task mentioning admin nav link
next_action: Return diagnosis to orchestrator — no fix applied (goal: find_root_cause_only)

## Symptoms

expected: Admins can reach /admin from the UI without typing the URL manually
actual: No UI entry point to /admin — admins must type the URL manually. Navbar has Topics and Archive links but no conditional admin link based on useAuth().isAdmin (which is already exposed at src/contexts/AuthContext.tsx:151). MobileNav also has no /admin entry.
errors: None reported
reproduction: UAT Test 3 in .planning/phases/04-admin-panel-suggestion-management/04-UAT.md
started: Phase 4 UAT 2026-04-19 (feature never shipped — not a regression)

## Eliminated

- hypothesis: Link was planned but dropped during implementation
  evidence: Grep of 04-03-PLAN.md shows Navbar work was strictly for the WTCS logo (D-03). Task 1 explicitly says "Do NOT remove existing navbar links, theme toggle, user menu, or sign-out button — only ADD the logo." No task in any Plan 04-0X mentions an admin link. SUMMARY 04-03 confirms only logo was added ("Navbar logo visible on every page").
  timestamp: 2026-04-18

- hypothesis: Link exists but is broken/hidden under a gate
  evidence: Navbar.tsx:36-53 desktop nav only renders Topics + Archive under `{user && (...)}`. MobileNav.tsx:30-49 same. No `/admin` Link anywhere in either file. No conditional on isAdmin at all — hook isn't even imported in MobileNav.tsx.
  timestamp: 2026-04-18

## Evidence

- timestamp: 2026-04-18
  checked: src/components/layout/Navbar.tsx (entire file, 125 lines)
  found: Desktop nav (lines 36-53) has only two Link elements — `/topics` and `/archive`. Both gated only on `{user && ...}`. No `/admin` Link. `useAuth()` is imported (line 10) and destructured to `{ user, profile, signOut, signInWithDiscord }` at line 16 — isAdmin is NOT pulled even though exposed.
  implication: Feature simply not wired. Easy additive fix — the data (isAdmin) is one destructure away.

- timestamp: 2026-04-18
  checked: src/components/layout/MobileNav.tsx (entire file, 53 lines)
  found: Sheet body at lines 30-49 contains only `/topics` and `/archive` SheetClose+Link pairs. No useAuth import, no conditional logic, no /admin link.
  implication: Mobile surface is identical omission. Fix must cover both.

- timestamp: 2026-04-18
  checked: src/contexts/AuthContext.tsx:151
  found: `isAdmin: profile?.is_admin ?? false` exposed in AuthContext value. useAuth() hook at src/hooks/useAuth.ts returns full AuthState including isAdmin.
  implication: No backend/auth plumbing needed — the signal is already reactive and app-wide.

- timestamp: 2026-04-18
  checked: src/routes/admin/index.tsx + sibling admin routes (suggestions/new.tsx, suggestions/$id.edit.tsx)
  found: All three admin routes wrap their component body in `<AdminGuard>` (confirmed at index.tsx:26-31, new.tsx:12-14, $id.edit.tsx:13-15). AdminGuard exists at src/components/auth/AdminGuard.tsx with tests in src/__tests__/auth/auth-guard.test.tsx.
  implication: Safe to show the link to all users without risk — but UX-correct approach is still to hide unless isAdmin (avoids teasing unreachable destinations). AdminGuard is the defensive backstop.

- timestamp: 2026-04-18
  checked: .planning/phases/04-admin-panel-suggestion-management/04-03-PLAN.md + 04-03-SUMMARY.md
  found: Plan 04-03 Task 1 touched Navbar.tsx explicitly, but ONLY to add the WTCS logo (D-03). Task instructions at line 221: "Do NOT remove existing navbar links, theme toggle, user menu, or sign-out button — only ADD the logo." Grep across all Phase 4 plans/summaries for "admin link" / "entry point" returns no hits for Navbar navigation. Feature was never scoped.
  implication: Pure scope gap. No design decision to rediscover; planner can define the UX (label, placement, gating) fresh.

- timestamp: 2026-04-18
  checked: Existing conditional-link patterns (grepped for isAdmin across src)
  found: isAdmin is consumed in src/components/auth/AdminGuard.tsx for route protection and implicitly in AdminsList. No existing navbar/header component conditionally renders a link based on isAdmin — this will be the first such pattern.
  implication: No existing pattern to mirror for nav gating. Planner establishes the pattern; simple `{isAdmin && <Link to="/admin">Admin</Link>}` is sufficient.

- timestamp: 2026-04-18
  checked: src/__tests__/ for Navbar/MobileNav test coverage
  found: No existing test files for Navbar.tsx or MobileNav.tsx under src/__tests__/. Nothing to update — if test coverage is desired, it is a new file.
  implication: Planner should decide whether to scope a minimal RTL test (render with isAdmin=true shows link, isAdmin=false hides it) — optional but low-cost.

## Resolution

root_cause: Feature omission in Phase 4 Plan 04-03. The plan scoped Navbar.tsx edits for the WTCS logo only (D-03); no task in Plans 04-01 through 04-04 ever scoped a conditional "Admin" link in either Navbar.tsx or MobileNav.tsx. The auth state for gating (`isAdmin` via useAuth) was already wired (AuthContext.tsx:151) and the destination route (/admin) is AdminGuard-protected — everything needed is in place, the UI affordance just wasn't built.

fix: (deferred — diagnose-only mode)

verification: (deferred — diagnose-only mode)

files_changed: []
