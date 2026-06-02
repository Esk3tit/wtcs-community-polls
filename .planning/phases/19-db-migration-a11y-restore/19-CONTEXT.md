# Phase 19: DB Migration + A11y Restore - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Two unrelated remediation workstreams bundled into one phase:

1. **DBHY-05 (DB):** Replace the broken `current_user = session_user` gate in the
   `profile_self_update_allowed` BEFORE-UPDATE trigger with a session-GUC
   trusted-context flag set by `update_profile_after_auth` (STATE.md **Option b**,
   locked by REQUIREMENTS). Ship as a new migration. Prove the protected-column
   branch is reachable and correct via a regression test.
2. **UIDN-06 (UI):** Restore the two section headings in `AdminsList` and
   `CategoriesList` — demoted to a non-semantic `<div>` `CardTitle` with an ARIA
   workaround during Phase 17 — to true semantic `<h2>` elements, keeping the
   shadcn `<Card>` structure intact, verified by an accessibility assertion.

The WHAT is locked by REQUIREMENTS (Option b mandated; restore semantic `<h2>`)
and the ROADMAP success criteria. This discussion only clarifies HOW.

**Not in scope (own phases):** Phase 20 UAT gaps (UAT-01/02), Phase 21 dependency
hygiene (DEP-01/02).
</domain>

<decisions>
## Implementation Decisions

### DB — trusted-context flag (DBHY-05)
- **D-01:** Use a **transaction-local** session GUC. `update_profile_after_auth`
  sets it via `set_config('app.<name>', 'on', true)` — the `true` (is_local)
  argument scopes the flag to the current transaction so it auto-clears on
  commit/rollback and **cannot leak across PgBouncer-pooled connections**. A
  session-local flag was explicitly rejected as a pooling-bypass risk.
- **D-02:** `profile_self_update_allowed` checks the flag (e.g.
  `current_setting('app.<name>', true) = 'on'`) instead of `current_user =
  session_user`. Flag present/'on' ⇒ trusted RPC path, skip protected-column
  checks. Flag absent ⇒ direct client update, enforce protected-column rules.
  Note `SET search_path = ''` is in force on these functions (per migration
  00000000000014) — fully-qualify and account for that in the GUC/`current_setting`
  usage. Final GUC name (`app.trusted_profile_update` suggested) left to planning.
- **D-03:** **Fully replace** the `current_user = session_user` check — remove it
  entirely; the GUC flag is the sole discriminator. Matches REQUIREMENTS wording
  ("replaced") and avoids two overlapping mechanisms, one of which is provably
  non-functional. "Keep both" (defense-in-depth) was rejected as confusing dead weight.
- **D-04:** Immutable-column checks (`id`, `discord_id`, `created_at`) stay
  enforced **unconditionally** for all callers — they sit outside the gated block
  today and must remain so.

### DB — regression test (DBHY-05)
- **D-05:** Prove reachability with an **integration test exercising both paths**,
  in `e2e/integration/` via Vitest + supabase-js against the local stack (TEST-11
  / `vote-counts-rls.test.ts` precedent; use `mintClients` from
  `e2e/integration/helpers.ts`). It must assert:
  - (a) an **authenticated client** UPDATE to a protected column (`mfa_verified`,
    and ideally `is_admin` / `guild_member`) on its own profile row is **rejected**
    by the trigger's exception message; and
  - (b) the `update_profile_after_auth` RPC **succeeds** in committing
    `mfa_verified` / `guild_member`.
  The DB-level/pgTAP approach was set aside (no such harness exists in the repo;
  the integration harness is sufficient and already maintained).

### UI — semantic heading restore (UIDN-06)
- **D-06:** Restore `<h2>` via a **polymorphic `CardTitle`** — add Radix `Slot`
  `asChild` support to the vendored `src/components/ui/card.tsx` `CardTitle`, then
  render `<CardTitle asChild><h2 …>…</h2></CardTitle>` in `AdminsList` and
  `CategoriesList`. Reusable for future Cards; preferred over duplicating
  CardTitle styling in an inline `<h2>`. Remove the `role="heading"
  aria-level={2}` ARIA workaround now that the element is a real heading.
- **D-07:** Verify with `getByRole('heading', { level: 2 })` (React Testing
  Library) for the two components — lightweight and targeted. (An axe scan is
  acceptable if a planner prefers broader coverage, but the role/level assertion
  is the minimum bar the success criterion requires.)

### Claude's Discretion
- Exact GUC name, migration filename/number, and whether the `is_admin` assertion
  is added alongside `mfa_verified` in the regression test.
- Whether to bundle DB + a11y in one PR or split — both are small; default to a
  single phase PR unless review noise argues otherwise.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB — current live definitions & history
- `supabase/migrations/00000000000014_harden_security_definer_search_path.sql` —
  the **live** definitions of `profile_self_update_allowed` and
  `update_profile_after_auth` (with `SET search_path = ''`). The new migration
  replaces the gate in this version.
- `supabase/migrations/00000000000004_fix_trigger_rpc_context.sql` — historical
  note on why the `current_user != session_user` skip was introduced (the broken
  approach being replaced).
- `supabase/migrations/00000000000001_rls.sql` §"Users can update own profile"
  (lines ~30–95) — the **only** UPDATE policy on `profiles`; row-level only
  (`id = auth.uid()`), **no column restriction** — all column protection is
  delegated to the trigger. This is why a direct client UPDATE reaches the trigger.
- `supabase/migrations/00000000000002_triggers.sql` — the BEFORE-UPDATE trigger
  binding on `public.profiles`.

### DB — regression test harness
- `e2e/integration/vote-counts-rls.test.ts` — TEST-11 precedent: Vitest +
  supabase-js invariant matrix against the local stack. Closest analog for the
  DBHY-05 test.
- `e2e/integration/helpers.ts` — `mintClients({ authAs })`, fresh-row, and cleanup
  helpers to reuse.
- `src/lib/auth-helpers.ts` — the client-side caller of `update_profile_after_auth`
  (4-param signature) to mirror in the RPC-path assertion.

### UI — components & shared primitive
- `src/components/admin/AdminsList.tsx` (~line 94) — current `CardTitle` with
  `role="heading" aria-level={2}` to restore.
- `src/components/admin/CategoriesList.tsx` (~line 171) — same pattern to restore.
- `src/components/ui/card.tsx` (`CardTitle`, line ~31) — vendored shadcn primitive
  to make polymorphic via `asChild`.
- `.planning/phases/17-*/17-REVIEW.md` (WR-01) — origin of the heading demotion
  being reversed.

### Phase context
- `.planning/ROADMAP.md` §"Phase 19" — goal + success criteria.
- `.planning/REQUIREMENTS.md` — DBHY-05, UIDN-06 full text.
- `.planning/STATE.md` — "DBHY-05 remediation context" (Option b rationale).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `e2e/integration/helpers.ts` `mintClients` / fresh-poll / cleanup helpers —
  directly reusable for the DBHY-05 regression test (anon / authed / serviceRole
  clients minted once).
- shadcn `CardTitle` in `src/components/ui/card.tsx` — extend with `asChild`
  rather than introducing a parallel heading component.
- `radix-ui` (1.4.3, already a dependency) provides `Slot` for the `asChild` change.

### Established Patterns
- Integration/RLS-trigger invariants are tested with Vitest + supabase-js against
  the **local Supabase stack**, not Playwright (see TEST-11 rationale comment).
  Reminder (memory): export current stack keys before `npm run test:integration`.
- All mutations go through Edge Functions / SECURITY DEFINER RPCs with the
  service-role key; the **only** authenticated-role UPDATE surface is the
  self-profile policy guarded by this trigger.
- Migrations are append-only numbered SQL under `supabase/migrations/`; functions
  carry `SECURITY DEFINER` + `SET search_path = ''`.

### Integration Points
- New migration → `profile_self_update_allowed` (trigger body) +
  `update_profile_after_auth` (adds the `set_config` flag).
- Regression test → `e2e/integration/` (new file), local stack.
- UI change → `ui/card.tsx` (`CardTitle` asChild) consumed by `AdminsList` /
  `CategoriesList`; component tests assert heading role/level.

</code_context>

<specifics>
## Specific Ideas

**Severity reframing — capture for the planner (raised during discussion):**
The protected-column branch is **not "suspected dead code" — it is currently
bypassed**, which is worse. Because the trigger is `SECURITY DEFINER`,
`current_user` = owner ≠ `session_user` = `authenticated` on *every* direct client
UPDATE, so the `IF current_user = session_user` block is **always skipped**. The
`profiles` RLS policy permits an authenticated user to UPDATE their own row with
no column restriction. Net effect: today a direct authenticated client UPDATE to
`is_admin` / `mfa_verified` / `guild_member` on one's own profile is **not
blocked** — a live privilege-escalation path, contingent on the standard
Supabase `authenticated` table UPDATE grant.

Consequences:
- The Option-b GUC fix is the actual security closure (flag absent ⇒ protected
  check runs ⇒ reject).
- The regression test (D-05) is a **real exploit guard**: it should demonstrate
  the fix flips a protected-column client UPDATE from *silently accepted* →
  *rejected*. Worth confirming the pre-fix behavior to make the guard meaningful.
- **Flag for the owner:** current production may be exposed. Consider whether the
  migration warrants expedited deployment ahead of the rest of the phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The "expedite to prod" point above
is about *sequencing* the in-scope migration, not new scope.)

</deferred>

---

*Phase: 19-db-migration-a11y-restore*
*Context gathered: 2026-06-01*
