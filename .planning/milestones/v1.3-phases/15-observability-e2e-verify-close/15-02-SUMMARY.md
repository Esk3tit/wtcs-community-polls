---
plan: 15-02
phase: 15-observability-e2e-verify-close
status: complete
tasks_completed: 2
tasks_total: 2
---

# 15-02 Summary — verify-sourcemap-names.mjs

## Tasks completed

- **Task 1**: Cross-checked D-06 seed allowlist against fresh `npm run build` output; locked final 7-name allowlist.
- **Task 2**: Created `scripts/verify-sourcemap-names.mjs` with locked allowlist, structured failure exits, and zero npm dependencies.

## Locked allowlist

| Name | Source path | Rationale |
|------|-------------|-----------|
| `RenderThrowSmoke` | `src/components/debug/` | Required canary; verified in Phase 7 baseline |
| `ConsentProvider` | `src/contexts/ConsentContext.tsx` | Consent context provider; GDPR opt-in path |
| `ConsentBanner` | `src/components/` | Consent UI render path |
| `AdminGuard` | `src/components/auth/` | Admin auth boundary |
| `AuthProvider` | `src/contexts/AuthContext.tsx` | Auth shell |
| `RootLayout` | `src/routes/__root.tsx` | Top-level app shell |
| `AppErrorFallback` | `src/components/` | React error boundary |

**Seed names replaced:**
- `AuthGate` → `AuthProvider`: `AuthGate` is an arrow-function component; not emitted as `function AuthGate(` even with `keepNames: true`.
- `App` → `RootLayout`: `App` is not emitted as a function declaration; `RootLayout` covers the shell path.

## Validation evidence

### Build (exit code)
```
npm run build → exit 0
✓ built in 690ms (37 JS chunks in dist/assets/)
```

### Happy path
```
$ node scripts/verify-sourcemap-names.mjs
[verify-sourcemap-names] OK: 37 chunk(s) scanned, 7/7 allowlisted names found — keepNames contract holds.
Exit code: 0
```

### Sad path (bogus name `NonExistentComponent`)
```
[verify-sourcemap-names] FAIL: 1 name(s) missing from dist/assets/*.js
  - NonExistentComponent
This means vite.config.ts rolldownOptions.output.keepNames may have regressed. Restore the flag or update the allowlist if a name was renamed in source.
Exit code: 1
```

### No-dist path
```
$ rm -rf dist && node scripts/verify-sourcemap-names.mjs
[verify-sourcemap-names] ERROR: dist/assets/ not found.
Run `npm run build` first, then re-run this script.
Exit code: 1
```

### Lint
```
npm run lint → exit 0
```
(Script is a `.mjs` file; ESLint flat config `files: ['**/*.{ts,tsx}']` does not lint `.mjs` files.)

## Deviations

None. All acceptance criteria met. Plan 15-03 will wire this script into CI.

## Commits

- `63878b3` — feat(ci): add verify-sourcemap-names.mjs regression guard (15-02, OBSV-04)
