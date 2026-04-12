---
phase: 04
slug: admin-panel-suggestion-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (source-analysis pattern per existing `rate-limit-edge-function.test.ts`) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*Populated by gsd-planner during plan creation — one row per task referencing plan/wave/requirement.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/admin/admin-auth-coverage.test.ts` — source-analysis coverage for ADMN-02/03/04 (asserts every gated Edge Function imports `_shared/admin-auth.ts` and calls `requireAdmin`, returns 403 on non-admin)
- [ ] `src/__tests__/admin/suggestion-crud-edge.test.ts` — source-analysis stubs for POLL-01..07 (verify create/update/close/pin/delete/set-resolution/get-upload-url Edge Functions exist, import admin-auth helper, use EXISTS guards for D-17/D-18)
- [ ] `src/__tests__/admin/category-crud-edge.test.ts` — source-analysis stubs for CATG-01 (create/rename/delete-category)
- [ ] `src/__tests__/admin/lifecycle-edge.test.ts` — source-analysis stubs for LIFE-01/02/03 (verify `close-expired-polls` EF exists with sweep UPDATE and documented no-auth carve-out)
- [ ] `src/__tests__/admin/admin-migration.test.ts` — source-analysis test verifying `is_current_user_admin()` helper is defined and admin-bypass RLS policies reference it in `00000000000005_admin_phase4.sql`
- [ ] `src/__tests__/admin/promote-admin.test.ts` — source-analysis stubs for ADMN-04 promote flow (both `target_user_id` and `target_discord_id` branches, snowflake regex)
- [ ] `src/__tests__/admin/demote-admin.test.ts` — source-analysis stubs for D-06 self-demote guard (asserts server returns 400 "Cannot demote yourself")
- [ ] No new framework install needed — vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin form mobile layout | Success Criterion 6 | Visual/responsive check on real device | Open `/admin/suggestions/new` on phone screen (375px), confirm all fields reachable without horizontal scroll |
| Image upload end-to-end | POLL-02 | Requires Supabase Storage interaction | Log in as seed admin, upload JPEG ≤2MB, confirm image appears on public poll card |
| Auto-close on timer expiry | LIFE-01 | Requires time passage or manual trigger | Create suggestion with 5-minute custom timer, wait, confirm public view shows closed status via `polls_effective` view (lazy close) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
