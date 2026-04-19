---
phase: 04-admin-panel-suggestion-management
status: deferred
---

## Pre-existing lint baseline (out of scope for 04-05)

`npm run lint` reports 7 `react-refresh/only-export-components` errors in files untouched by this plan:

- src/components/ui/badge.tsx
- src/components/ui/button.tsx
- src/routes/__root.tsx
- src/routes/auth/callback.tsx
- src/routes/auth/error.tsx
- src/routes/index.tsx

These existed on the branch tip prior to 04-05 work (verified via `git stash && npm run lint` — same 7 errors). The 04-05 gate required "no new violations on Navbar.tsx or MobileNav.tsx", which is satisfied — neither of my modified files appear in the error list. The pre-commit lint-staged hook runs ESLint only against staged files, which is why this baseline has been accumulating silently across prior commits. Deferred to a future hygiene plan.
