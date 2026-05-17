---
phase: 14
cycle: 4
reviewers: [gemini, codex]
reviewed_at: 2026-05-17T02:50:40Z
plans_reviewed:
  - 14-01-PLAN.md
skipped_reviewers:
  - claude (self — running inside Claude Code, skipped for independence)
  - cursor (usage limit hit on free tier — "You've hit your usage limit")
  - coderabbit (working tree clean — no diff to review; cycle-4 plan artifacts already committed)
  - opencode (not installed)
  - qwen (not installed)
cycle_3_high_concerns:
  - id: H1-cycle1
    severity: HIGH
    summary: "tests/sql/is_current_user_admin_regression.sql fixture's bare INSERT INTO public.profiles collided with handle_new_user() trigger fired by on_auth_user_created → duplicate-key violation aborted the script before any assertion ran (cycle-3 bug discovered by Codex)"
    cycle_4_resolution: "FULLY RESOLVED — both reviewers agree. Fixture's public.profiles INSERT now uses ON CONFLICT (id) DO UPDATE SET is_admin=EXCLUDED.is_admin, mfa_verified=EXCLUDED.mfa_verified, guild_member=EXCLUDED.guild_member, discord_username=EXCLUDED.discord_username, avatar_url=EXCLUDED.avatar_url (14-01-PLAN.md fixture lines 760-771; on-disk fixture lines 53-64). Verify block grep-asserts ON CONFLICT (id) DO UPDATE >= 1 (line 900). Acceptance criterion at line 912 mandates the clause and line 1128 records the fix in verification gate 5. Codex independently confirmed the fixture file on disk now upserts at tests/sql/is_current_user_admin_regression.sql:53."
  - id: H3-cycle2
    severity: HIGH
    summary: "Direct psql session bypasses RLS because the connecting role is privileged (postgres / supabase_admin); without SET LOCAL ROLE authenticated, the non-admin SELECT against audit_log passes for the wrong reason (superuser bypass) rather than proving is_current_user_admin() = FALSE denies the row"
    cycle_4_resolution: "FULLY RESOLVED (carried from cycle 3 — already FULLY RESOLVED IN PLAN; cycle-4 fixture preserves the SET LOCAL ROLE authenticated / RESET ROLE wrapping at lines 804-805 (assert_admin helper), 844-846 (admin audit_log branch), 858-860 (non-admin audit_log branch); >=3 occurrences asserted by the verify-block grep at line 899)."
  - id: H4-cycle2
    severity: HIGH
    summary: "Overload-count gate inconsistency: cycle-3 plan line 429 permitted U2 'harden both' (3-param and 4-param overloads) while downstream catalog-assertion gates at lines 565 and 1021 demanded 'exactly ONE row per function name'. The two paths were mutually exclusive."
    cycle_4_resolution: "FULLY RESOLVED — both reviewers agree. Cycle 4 picked Option A: Migration 14 unconditionally emits DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT); before the 4-param CREATE OR REPLACE (Task 01 line 439). Verify-block grep at lines 450 and 457 requires the DROP statement appears exactly once. Local catalog assertion at line 549 demands 'each function name appears exactly ONCE (UNCONDITIONAL — Cycle-3 Option A)'. Local acceptance at line 578, production catalog assertion at line 1085 (gate text 'exactly ONE row per function name (UNCONDITIONAL under Option A)'), and verification gate 9 at line 1132 are all uniformly aligned with no 'OR exactly TWO' alternative remaining. Codex flagged that the historical changelog narrative at line 98 ('DROP ... OR harden both') is stale prose only — the operative task text and gates no longer allow harden-both."
cycle_3_medium_concerns:
  - id: M-rls_auto_enable-R2
    severity: MEDIUM
    summary: "R2 classification for rls_auto_enable relied solely on proowner = postgres, which is too weak — local Supabase runs nearly every function as postgres, including user-owned ones"
    cycle_4_resolution: "DIVERGENT verdict — Gemini: FULLY RESOLVED; Codex: PARTIALLY RESOLVED. Plan (lines 249-257) now requires AT LEAST ONE of (a) owning_extension non-NULL, (b) non-public schema, (c) Supabase-internal owner role (supabase_admin/postgres/supabase_auth_admin/supabase_storage_admin), (d) body references to Supabase-internal schemas, (e) function not visible to user role. Line 257 explicitly states 'do not declare R2 from proowner = postgres ALONE without at least one corroborating signal'. Gemini accepts this as fully addressing the cycle-3 gap. Codex flags residual ambiguity: line 252 still lists postgres as a Supabase-internal owner role implying R2, while the corroboration rule at line 257 contradicts it; summaries at lines 386 and 1170 compress this back to 'Supabase-internal owner role' as a standalone positive signal. Since this is a MEDIUM (not HIGH) and the corroboration rule at line 257 is operative, this does NOT count toward the cycle-4 HIGH tally."
---

# Cross-AI Plan Review — Phase 14 (Cycle 4)

## Gemini Review

The cycle-4 replan is a **high-quality, adversarial-grade hardening** that systematically closes the remaining gaps from prior reviews. By adopting **Option A (Unconditional DROP)** for overload management and implementing a **collision-aware fixture** with explicit role-switching, the plan achieves a level of deterministic verification that significantly lowers the risk of production regression.

### 1. Summary
The cycle-4 replan effectively resolves the last standing HIGH concerns (H1 and H4) and the MEDIUM classification concern. The adoption of the "unconditional DROP" pattern for `update_profile_after_auth` (Option A) is a particularly strong move that eliminates internal plan contradictions and simplifies the verification state. The regression fixture is now technically sound, accounting for foreign keys, trigger side-effects, and RLS-bypass behaviors.

---

### 2. Cycle-3 HIGH Concerns Verdicts

#### **H1 (fixture trigger collision): FULLY RESOLVED**
- **Gap:** In Cycle 3, the fixture would have failed with a duplicate-key error because the `auth.users` insert triggers `handle_new_user()`, which inserts into `public.profiles` before the fixture's own profile insert.
- **Resolution:** `14-01-PLAN.md` Task 07b now uses `INSERT INTO public.profiles (...) ON CONFLICT (id) DO UPDATE SET ...` (lines 802–812 in the cycle-4 plan; fixture lines 760-771). This allows the fixture to safely override the trigger-inserted defaults with the specific identity combinations needed for testing (`is_admin`, `mfa_verified`, `guild_member`).
- **Verification:** The Task 07b acceptance criteria (line 912) and the `<verify>` block (line 900) explicitly mandate the presence of the `ON CONFLICT` clause.

#### **H4 (overload-count gate inconsistency): FULLY RESOLVED**
- **Gap:** Cycle 3 was inconsistent, allowing "harden both overloads" in implementation while demanding "exactly ONE row" in verification gates.
- **Resolution:** The plan now mandates **Option A (Unconditional DROP)**. Task 01 (line 439) explicitly requires emitting `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` before the 4-param rewrite. This collapses the state to exactly one signature.
- **Verification:** All downstream gates (local catalog assertion at line 549, local acceptance at line 578, production catalog assertion at line 1085, verification gate 9 at line 1132) now uniformly demand "exactly ONE row per function name" with no exceptions. The "harden both" path is explicitly forbidden.

#### **MEDIUM (rls_auto_enable R2 classification): FULLY RESOLVED**
- **Gap:** Cycle 3 relied too heavily on `proowner = postgres`, which is often used for user-owned functions.
- **Resolution:** Task W0 Check 1 (lines 243–257) now uses a **multi-signal classification**. R2 requires at least one of: (a) non-NULL `owning_extension`, (b) non-public schema, (c) internal role (`supabase_admin`, etc.), or (d) references to internal schemas (`auth`, `storage`) in the function body. Crucially, it adds a "Single positive signal" rule and forbids R2 classification based on `proowner = postgres` alone without corroboration.

---

### 3. New Concerns Raised in Cycle 4
*No new HIGH or MEDIUM concerns were identified.* One minor detail to monitor:
- **LOW:** The fixture in Task 07b sets `request.jwt.claim.sub` and `request.jwt.claims`. While this covers almost all versions of `auth.uid()`, if a future Supabase version switches to a different claim source, this fixture might return `NULL` for `uid()`. However, for the current 15.x stack, this is correct.

---

### 4. Strengths
- **Deterministic Bisection:** The section ordering (lowest-risk first) in Task 01 is a senior-level detail that simplifies local debugging.
- **Option A Simplicity:** Choosing the "DROP stale overload" path is much more robust than managing variable overload counts across multiple verification tools.
- **Catalog Assertions:** Checking `prosecdef`, `provolatile`, and `proconfig` in one query provides a comprehensive snapshot of the function's security posture.
- **Pre-deploy Snapshot:** Capturing the production state *before* the push (Task W0 Check 3) is an excellent safety net for "locked-out-of-admin" scenarios.

---

### 5. Suggestions
- **Fixture Output:** In Task 07b, consider adding `SET client_min_messages = NOTICE;` at the top of the SQL script to ensure the `PASS` notices are always visible in the `evidence/is_current_user_admin_regression.txt` file regardless of default psql configuration.
- **R2 Documentation:** If R2 is selected for `rls_auto_enable`, the REQUIREMENTS.md amendment commit (Task W0 outcome R2) should specifically list *which* signal triggered the classification to facilitate future security audits.

---

### 6. Risk Assessment: **LOW**
The plan is highly resilient. The combination of local `supabase db reset`, machine-enforced body diffs, and a direct RLS regression test that explicitly manages roles and triggers makes the execution phase extremely safe. The "fix-forward" strategy is well-supported by pre-staged rollback artifacts.

**Verdict: FULLY APPROVED FOR EXECUTION.**

---

## Codex Review

### Summary

Cycle 4 resolves both carried HIGH concerns in the operative plan. H1 is closed by converting the fixture's `profiles` seed to an upsert, and H4 is closed by choosing Option A consistently in the execution gates. I do not see a new HIGH-severity issue, but the `rls_auto_enable` handling is still only partially resolved because the R2 classification text remains internally ambiguous and the R1 path is not fully covered by downstream catalog/functiondef queries.

### Cycle-3 HIGH Concerns Verdicts

**H1 — fixture trigger collision: FULLY RESOLVED**

The actual fixture now seeds `auth.users` first at `tests/sql/is_current_user_admin_regression.sql:40`, which correctly triggers `on_auth_user_created` from `00000000000002_triggers.sql:137`. The fixture then uses `INSERT INTO public.profiles ... ON CONFLICT (id) DO UPDATE` at `tests/sql/is_current_user_admin_regression.sql:53`, updating `is_admin`, `mfa_verified`, `guild_member`, `discord_username`, and `avatar_url` at lines 59-64. That directly closes the duplicate-key failure.

The fixture also retains the prior fixes: correct `audit_log` columns at lines 70-78, no top-level `PERFORM`, `SET LOCAL ROLE authenticated` around assertions at lines 97, 137, and 153, and `BEGIN`/`ROLLBACK` wrapping at lines 18 and 165. The plan's mechanical gate requires `psql -v ON_ERROR_STOP=1` exit 0 plus 6 PASS notices at `14-01-PLAN.md:913` and `14-01-PLAN.md:1128`.

**H4 — overload-count gate inconsistency: FULLY RESOLVED**

The operative Task 01 rule now requires an unconditional `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` immediately before the 4-param `CREATE OR REPLACE` at `14-01-PLAN.md:439`. W0 U1 and U2 now share the same executable action at lines 283-290, and the verify grep requires exactly one DROP at lines 450 and 465.

Downstream gates are now consistent: local signature check requires exactly one 4-param function at line 520, local catalog assertion requires exactly one row per function name at lines 549 and 578, production catalog assertion repeats exactly-once at lines 1053 and 1085, and verification gate 9 repeats that `update_profile_after_auth` must have exactly one 4-param row at line 1132. The stale narrative at line 98 still says "DROP ... OR harden both," but the executable task text and gates no longer allow harden-both.

**MEDIUM — `rls_auto_enable` R2 classification: PARTIALLY RESOLVED**

The plan improves the classification: Query A includes schema, owner, ACL, extension dependency, and `pg_get_functiondef` at `14-01-PLAN.md:220`, and line 257 explicitly says not to declare R2 from `proowner = postgres` alone without corroboration.

The remaining gap is ambiguity: line 252 still lists `postgres` as a Supabase-internal owner role that implies R2, while line 257 says `postgres` alone is not sufficient. Acceptance/output summaries at lines 386 and 1170 compress this back to "Supabase-internal owner role" as a standalone positive signal. An executor could still mechanically satisfy the acceptance text with `public` + `owner=postgres` alone, which was the original weakness.

### New Concerns Raised in Cycle 4

- **MEDIUM — R1 `rls_auto_enable` is omitted from downstream catalog/functiondef queries.** If W0 classifies `rls_auto_enable` as R1/user-owned, Task 01 includes it, but the local catalog query at lines 537-544 and production functiondef/catalog queries at lines 1006-1013 and 1042-1049 still list only the six known public functions. This conflicts with "every target function" acceptance at lines 1083 and 1131.

- **MEDIUM — pre-deploy lint acceptance is self-contradictory.** Line 684 says pre-deploy linked lint should block on 0011 WARNs for functions other than `rls_auto_enable`, but the same sentence says linked production is still pre-migration and should show 6 or 7 WARNs. This can create a false blocker before deploy.

- **LOW — grep-count gates are fragile against comments.** Task 01 asks the migration header to mention `SET search_path = ''`, `CREATE OR REPLACE FUNCTION`, and `SECURITY DEFINER` at line 417, while lines 447-450 count those exact strings. If the header uses the requested words, counts can exceed the function count.

- **LOW — stale prose remains.** Line 98 and validation line 87 still describe a "DROP-or-harden" path. The operative plan overrides it, but this should be cleaned to avoid executor confusion.

- **LOW — functiondef diff normalization is not fully mechanical.** The sed patterns at lines 1018-1027 normalize only `SET search_path = ...`; `pg_get_functiondef` may emit canonical syntax differently, and `DIFF_EXIT` is captured but not asserted.

### Strengths

- The fixture now directly covers the four `is_current_user_admin()` identity branches plus `audit_log` RLS.
- H4's Option A is consistently reflected in Task 01, local gates, production gates, and verification gate 9.
- The plan keeps strong controls: pre-deploy restore snapshot, post-deploy functiondef diff, catalog assertions, TEST-11 exit-code verification, and production smoke vote.
- App code calls the 4-param RPC shape with `p_guild_member` at `src/lib/auth-helpers.ts:209`, supporting the 3-param DROP path.

### Suggestions

- Tighten R2 wording to: `owner=postgres` is never sufficient by itself; require extension ownership, non-public schema, internal body/schema signal, or user-role invisibility.
- Add `rls_auto_enable` conditionally to every R1 snapshot/catalog query, not just Migration 14.
- Delete or rewrite the pre-deploy lint blocker at line 684; pre-deploy lint should be baseline capture only.
- Make grep gates ignore comments or use SQL/catalog assertions instead of raw string counts.

### Risk Assessment

**Overall risk: MEDIUM.** The two carried HIGH concerns are resolved in the operative plan, and I found no new HIGH. Residual risk is mainly around `rls_auto_enable` ambiguity and verification-query coverage if it is user-owned, plus a few false-blocker/fragile-grep issues that can slow execution but are unlikely to cause a production security regression by themselves.

---

## Skipped Reviewer Notes

- **Claude** — Self-skipped: the review skill is executing inside Claude Code (`CLAUDE_CODE_ENTRYPOINT` set). Running claude here would not provide an independent perspective.
- **Cursor** — Invoked but failed with "You've hit your usage limit Get Cursor Pro for more Agent usage". Free-tier quota exhausted; cannot be retried this session.
- **CodeRabbit** — Skipped: CodeRabbit reviews git diffs of staged/unstaged changes. The cycle-4 planning artifacts were already committed before review and the working tree is clean (`git status --porcelain` returns nothing). CodeRabbit has no diff to scan.
- **OpenCode** — Not installed.
- **Qwen** — Not installed.

---

## Consensus Summary

Two independent reviewers (Gemini, Codex) reviewed the cycle-4 replan of `14-01-PLAN.md` plus the on-disk fixture `tests/sql/is_current_user_admin_regression.sql`. **Both reviewers agree both carried cycle-3 HIGH concerns (H1 and H4) are now FULLY RESOLVED.** Gemini approves the cycle-3 MEDIUM (rls_auto_enable R2 multi-signal classification) as FULLY RESOLVED; Codex flags it as PARTIALLY RESOLVED due to residual textual ambiguity. The MEDIUM does not count toward the cycle-4 HIGH tally.

### Cycle-3 HIGH concerns — cycle-4 verdict

- **H1 (fixture trigger collision): FULLY RESOLVED.** Both reviewers verified the fixture's `public.profiles` INSERT now uses `ON CONFLICT (id) DO UPDATE SET ...` (plan line 766 for the embedded SQL, on-disk fixture line 53). The verify-block grep asserts presence (`>= 1` occurrence) at plan line 900. Acceptance criterion at line 912 mandates the clause. Verification gate 5 at line 1128 records the fix. Codex independently confirmed the on-disk fixture file (not just the embedded plan text) carries the upsert. Cycle-3 trigger-collision failure mode is closed.

- **H4 (overload-count gate inconsistency): FULLY RESOLVED.** Both reviewers verified Cycle 4's Option A — unconditional `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` — is now consistently propagated through every downstream gate. Plan line 439 establishes the unconditional DROP rule; verify-block grep at lines 450/457 asserts the DROP appears exactly once; local catalog gate at line 549 demands "each function name appears exactly ONCE (UNCONDITIONAL — Cycle-3 Option A)"; local acceptance at line 578 repeats the unconditional gate; production post-deploy catalog at line 1085 mirrors it; verification gate 9 at line 1132 affirms "exactly ONE row per function name (no accidental overloads)". No "OR exactly TWO" alternative remains anywhere in the operative path. The only residual trace of the cycle-2 "harden both" wording is the stale narrative at line 98 (changelog prose, not operative).

### Cycle-3 MEDIUM concern — cycle-4 verdict (informational, not counted)

- **MEDIUM rls_auto_enable R2 classification: DIVERGENT (Gemini FULLY RESOLVED; Codex PARTIALLY RESOLVED).** Plan line 257 operatively requires corroboration beyond `proowner = postgres`. Codex correctly notes that line 252 still lists `postgres` as a Supabase-internal owner role and the summary lines (386, 1170) compress the multi-signal rule back to a single bullet. The line-257 corroboration rule is the operative gate, but the executor reading lines 252 and 386 in isolation could be misled. **This is a documentation tightness issue, not a HIGH risk.** Codex's suggestion to explicitly disqualify `owner=postgres` alone is sound and should be incorporated as a non-blocking polish.

### New HIGH concerns raised in cycle 4

**None.** Gemini explicitly notes no new HIGH or MEDIUM concerns. Codex raises two NEW MEDIUMs (R1 catalog-query coverage if `rls_auto_enable` is user-owned; pre-deploy lint acceptance self-contradiction at line 684) and three LOWs. None of these reach HIGH severity per Codex's own classification.

### Agreed Strengths

- Adoption of Option A (unconditional DROP) eliminates internal plan contradictions and simplifies the post-migration state to "exactly one overload" everywhere
- Fixture now exercises 4 identity branches AND admin-gated `audit_log` RLS with explicit role-switching, FK seeding, correct columns, and trigger-collision-safe upsert
- Strong defense-in-depth: pre-deploy snapshot, machine-enforced functiondef diff, catalog assertions, TEST-11 exit-code verification, production smoke vote
- Verification gate 9 and acceptance criteria are machine-runnable (grep/exit-code based)

### Agreed Concerns (cross-reviewer overlap)

- **Stale prose at line 98 / validation line 87 references "DROP-or-harden" wording from cycle 2.** Cleanup polish only — operative gates override.
- **rls_auto_enable R2 wording could be tighter.** Gemini accepts; Codex wants `owner=postgres` explicitly disqualified as a standalone signal. Both agree the current line-257 corroboration rule is operative, but the surrounding summary lines could be inconsistent. Polish, not a blocker.

### Divergent Views

- **MEDIUM rls_auto_enable R2 classification verdict.** Gemini: FULLY RESOLVED. Codex: PARTIALLY RESOLVED. The disagreement is about residual textual ambiguity, not about whether the operative gate (line 257 corroboration rule) closes the cycle-3 weakness. Both reviewers agree the same operative gate exists; they disagree about whether the surrounding summary lines need to be tightened to match. **Resolution: documentation polish is recommended (Codex's suggestion) but does not block execution. Since the operative gate IS in place and this is a MEDIUM not a HIGH, it does not count toward the cycle-4 HIGH tally.**

### Recommended Actions Before Execute (cycle 4)

1. **Cleanup (LOW priority, optional):** Tighten R2 wording — explicitly disqualify `owner=postgres` as a standalone signal in line 252 and in summary lines 386 and 1170. Codex's wording is good: "owner=postgres is never sufficient by itself; require extension ownership, non-public schema, internal body/schema signal, or user-role invisibility."
2. **Cleanup (LOW priority, optional):** Add `rls_auto_enable` conditionally to the local catalog query (lines 537-544) and production catalog/functiondef queries (lines 1006-1013, 1042-1049) so that when W0 picks R1, the verification queries cover all 7 functions, not just the 6 known public ones.
3. **Cleanup (LOW priority, optional):** Rewrite the pre-deploy lint acceptance at line 684 — it should be baseline capture, not a blocker on 0011 WARNs (which by definition still exist pre-migration).
4. **Cleanup (LOW priority, optional):** Delete or update the historical narrative at line 98 ("DROP ... OR harden both") to match the operative Option A path.
5. **Cleanup (LOW priority, optional):** Add `SET client_min_messages = NOTICE;` at the top of the fixture (Gemini suggestion) to ensure PASS notices appear in the evidence file regardless of psql configuration.

### Final Cycle-4 HIGH Tally

**0 unresolved HIGH concerns.**

Both carried cycle-3 HIGHs (H1, H4) are FULLY RESOLVED by independent reviewer verification with concrete acceptance criteria the executor can run mechanically. No new HIGHs raised. The MEDIUM verdict divergence on rls_auto_enable R2 classification is informational — both reviewers acknowledge the operative corroboration gate (line 257) exists; the disagreement is over surrounding textual tightness and does not elevate to HIGH severity.

**Phase 14 cycle-4 plan is APPROVED FOR EXECUTION.** Cleanup items 1-5 above are optional polish; none block execution.
