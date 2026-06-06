---
phase: 19-db-migration-a11y-restore
audited: 2026-06-03
mode: verify-mitigations-exist
register_authored_at_plan_time: true
status: secured
threats_total: 14
threats_closed: 14
threats_open: 0
asvs_level: unset
---

# Phase 19 Security Audit — db-migration-a11y-restore

**Audited:** 2026-06-03
**Mode:** VERIFY-MITIGATIONS-EXIST (threat register authored at plan time)
**ASVS Level:** unset (default L1/L2 web-app posture)
**Result:** SECURED — all mitigations present in code; one accepted-residual documentation gap noted (non-blocking)

This audit verifies that each declared threat disposition in the Phase 19 threat
register (19-01-PLAN, 19-02-PLAN, 19-03-PLAN) is actually present in the
implemented code on disk — not merely intended. Implementation files were treated
as read-only and were not modified.

---

## Threat Verification

### DBHY-05 — Migration 15 (19-01-PLAN)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-19-01 | Elevation of Privilege | mitigate | CLOSED | `supabase/migrations/00000000000015_trusted_profile_update_guc.sql:93` — gate is `pg_catalog.current_setting('app.trusted_profile_update', true) IS DISTINCT FROM 'on'` (null-safe), replacing the permanently-false `current_user = session_user`. Protected `mfa_verified`/`guild_member` checks at L95–100 fire when the GUC is absent. `is_admin` hardened to unconditional at L85–87 (see WR-02). Trigger reachable via `WHEN (current_setting('role') = 'authenticated')` (`00000000000002_triggers.sql:44`). Regression proof: `e2e/integration/profile-trigger-gate.test.ts` cases (a)(b)(c), 6/6 green this session. |
| T-19-02 | Spoofing | mitigate | CLOSED | Single-writer contract: the only `set_config('app.trusted_profile_update', ...)` call is inside `update_profile_after_auth` (migration 15 L42). PostgREST does not expose `set_config` to unprivileged clients. GUC-leak guard test case (f) (`profile-trigger-gate.test.ts:132–152`) confirms the flag does not persist past the RPC transaction. Strengthened by WR-02 (is_admin no longer inside the trusted bypass). |
| T-19-03 | Elevation of Privilege | mitigate | CLOSED | `migration 15:42` — `pg_catalog.set_config('app.trusted_profile_update', 'on', true)`; third arg `true` = `is_local=true` (transaction-local). Auto-clears on commit/rollback under PgBouncer transaction pooling. Proven by test case (f). |
| T-19-04 | Tampering | mitigate | CLOSED | Migration 15 makes the protected-column branch reachable (gate now functional). `profile-trigger-gate.test.ts` cases (a)(b)(c) prove the branch fires (RED pre-push, GREEN post-push per 19-03-SUMMARY). |
| T-19-05 | Tampering | mitigate | CLOSED | `migration 15` uses `CREATE OR REPLACE FUNCTION` exclusively (L26, L64); zero `DROP FUNCTION`. Trigger OID binding preserved. Signature unchanged from migration 14 (4-param) — no overload created. |
| T-19-06 | Elevation of Privilege | mitigate | CLOSED | `migration 15:131–132` — explicit `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` on the 4-param `update_profile_after_auth`. Anon role can no longer call the RPC. |
| T-19-07 | Spoofing | accept (residual) | CLOSED (with gap) | RPC trusts caller-supplied `p_mfa_verified`/`p_guild_member` (computed client-side in `src/lib/auth-helpers.ts:209–214`, from Discord `mfa_enabled` + `/users/@me/guilds`). Residual is documented in `COMMENT ON FUNCTION public.update_profile_after_auth` (`migration 15:117–125`) — explicit "TRUST BOUNDARY" + "accepted residual". **GAP:** the disposition claims this is recorded in "COMMENT ON FUNCTION + PROJECT.md"; PROJECT.md:234 documents the DBHY-05 *fix* but does NOT record the caller-supplied-trust *residual* (no mention of self-attestation / deferred server-side re-validation). See Accepted Risks Log + Notes below. Non-blocking: the code mitigation surface is complete and the primary documentation location (catalog COMMENT) is present and accurate. |
| T-19-SC | Tampering | accept | CLOSED | `tech_stack.added: []` in 19-01-SUMMARY; zero new package installs. |

### UIDN-06 — A11y heading restore (19-02-PLAN)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-19-06 (a11y) | Tampering | accept | CLOSED | `src/components/ui/card.tsx:2,37` — `import { Slot } from "radix-ui"` + `const Comp = asChild ? Slot.Root : "div"`. Same established pattern as button.tsx/badge.tsx; no new trust boundary. Recorded in Accepted Risks Log. |
| T-19-07 (a11y) | Spoofing | mitigate | CLOSED | `AdminsList.tsx:94–96` and `CategoriesList.tsx:171–173` — `<CardTitle asChild className="text-base"><h2>…</h2></CardTitle>`; `role="heading"`/`aria-level` removed (0 grep matches). Native `<h2>` emitted. Regression guard: `getByRole('heading', { level: 2 })` in admins-tab/categories-tab tests; 403/403 unit tests green. |
| T-19-SC | Tampering | accept | CLOSED | Zero installs; radix-ui already vendored. Recorded in Accepted Risks Log. |

### Deploy threats (19-03-PLAN)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-19-08 | Tampering | accept | CLOSED | Sequential filename ordering — `00000000000015_*` follows `00000000000014_*`. `migration list` confirmed 15 applied (19-03-SUMMARY). Recorded in Accepted Risks Log. |
| T-19-09 | Elevation of Privilege | mitigate | CLOSED | `profile-trigger-gate.test.ts` exercises both gate directions against the live local DB — 6/6 green this session (3 rejections + allowed-column + ordered flip→call→read-back RPC proof + GUC-leak guard). 19-03-SUMMARY Task 3. |
| T-19-10 | Denial of Service | mitigate | CLOSED | Both functions carry `SET search_path = ''` (`migration 15:35,68`) preventing `0011_function_search_path_mutable`. `supabase db lint --level warning` reported "No schema errors found" this session against the same local target as the apply (19-03-SUMMARY Task 2). |
| T-19-11 | Repudiation | accept | CLOSED | Local apply is the Phase 19 gate; prod `--linked` deploy explicitly tracked as DEFERRED to milestone ship (19-03-PLAN closure table; PROJECT.md:234). Recorded in Accepted Risks Log. |
| T-19-SC | Tampering | accept | CLOSED | Zero installs (verification-only plan; no files created/modified). Recorded in Accepted Risks Log. |

---

## Accepted Risks Log

| Threat ID | Risk | Why Accepted | Where Documented |
|-----------|------|--------------|------------------|
| T-19-07 (DBHY-05) | Authenticated client can self-attest `p_mfa_verified:true` / `p_guild_member:true` through the sanctioned RPC — values are not re-derived server-side | Pre-existing design since migration 02; NOT introduced or widened by Phase 19; no live users; full closure (Edge Function re-validating Discord state with server-held token) is a larger auth refactor outside DBHY-05 scope. WR-03 confirms it is tracked, not silent. | `COMMENT ON FUNCTION public.update_profile_after_auth` (migration 15:117–125). **PROJECT.md residual entry MISSING** — see Notes. |
| T-19-06 (a11y) | radix-ui `Slot.Root` prop merging | Established codebase dependency (button.tsx, badge.tsx); deterministic merge; no new trust boundary | 19-02-PLAN threat model |
| T-19-08 | Migration apply order | Sequential filename ordering guaranteed by Supabase | 19-03-PLAN threat model |
| T-19-11 | SC2 prod-deploy closure | No live users; prod `--linked` push ships in normal milestone order | 19-03-PLAN closure table; PROJECT.md:234 |
| T-19-SC (×3) | npm/pip/cargo installs | Zero new installs across all three plans | 19-01/02/03-SUMMARY |

---

## Unregistered Flags

None. All three SUMMARY "Threat Surface Scan" / "Threat Flags" sections report
no new attack surface:
- 19-01-SUMMARY: "No threat flags" — migration narrows trust surface (explicit REVOKE/GRANT, functional gate).
- 19-02-SUMMARY: "None. No new network endpoints, auth paths, or schema changes introduced."
- 19-03-SUMMARY: "No new threat flags" (verification-only plan).

---

## Post-Plan Hardening (code review WR-02) — verified present

The review-mandated WR-02 hardening is present on disk in migration 15:

- `is_admin` immutability check moved OUT of the GUC-gated branch into the
  always-enforced immutable-columns block (`migration 15:85–87`), alongside
  `id`/`discord_id`/`created_at`.
- Only `mfa_verified` and `guild_member` remain inside the GUC-gated branch
  (`migration 15:95–100`) — exactly the columns `update_profile_after_auth`
  writes.
- Exception message `'Cannot change is_admin via client'` preserved, so test
  case (b) `/is_admin via client/i` still matches.
- The `COMMENT ON FUNCTION profile_self_update_allowed` (L109–115) accurately
  describes `is_admin` as unconditional.

Effect: this strengthens T-19-01 and T-19-02 — the trusted-context bypass no
longer covers `is_admin`, so a future RPC reusing the GUC (or an extended
`update_profile_after_auth` accepting an `is_admin` param) cannot silently flip
admin status.

---

## Notes — Accepted-Residual Documentation Gap (non-blocking)

The T-19-07 disposition (and 19-REVIEW-FIX.md WR-03 skip rationale) both assert
the accepted residual is documented in **"the migration COMMENT and PROJECT.md."**

Verified:
- Migration COMMENT: PRESENT and accurate (`migration 15:117–125`) — explicit
  "TRUST BOUNDARY" and "accepted residual" language.
- PROJECT.md: line 234 documents the DBHY-05 *fix* (the GUC gate, REVOKE/GRANT,
  test proof) but does NOT record the caller-supplied-trust *residual*. There is
  no mention of `p_mfa_verified`/`p_guild_member` self-attestation, no statement
  that server-side Discord re-validation is deferred, and no residual-tracking
  entry. A `grep` for `residual` / `caller-supplied` / `re-validat` /
  `self-attest` in PROJECT.md returns no DBHY-05 hit.

Classification: this is an `accept`-disposition documentation completeness gap,
NOT an implementation gap. The mitigation code surface for DBHY-05 is complete,
and the primary durable documentation location (the catalog COMMENT, which
travels with the function definition) is present and correct. The residual is
therefore genuinely tracked. The gap is that the second claimed location
(PROJECT.md) does not carry the residual entry the disposition implies.

Suggested follow-up (does not block Phase 19 ship): add a one-line
accepted-residual entry to PROJECT.md so the tracked-risk register matches the
disposition claim — e.g. note that `update_profile_after_auth` trusts
caller-supplied MFA/guild flags and that server-side re-validation is deferred to
a future auth refactor.
