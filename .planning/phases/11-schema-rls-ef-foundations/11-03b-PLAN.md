---
phase: 11-schema-rls-ef-foundations
plan: 03b
type: execute
wave: 3
depends_on: [02]
files_modified:
  - supabase/functions/create-poll/index.ts
autonomous: true
requirements:
  - VIS-02
  - TEST-12
tags:
  - edge-function
  - audit
  - retrofit
  - results-hidden
  - supabase

must_haves:
  truths:
    - "`create-poll` imports `writeAudit` from `_shared/audit.ts` (same helper as Plan 11-03)"
    - "`create-poll` accepts an optional `results_hidden?: boolean` body field per D-08/D-10; default false; 400 when present-but-not-boolean"
    - "RPC signature `create_poll_with_choices` is UNCHANGED (Option A locked — see BLOCKER-2). The poll row INSERT uses the column DEFAULT (`results_hidden = false`) from migration 10"
    - "When the request body contains `results_hidden === true`, the EF runs a follow-up UPDATE against `polls` AFTER the RPC succeeds: `UPDATE polls SET results_hidden = true, results_hidden_changed_at = now() WHERE id = $1`. This UPDATE crosses RLS the same as any admin write (admin service-role client)."
    - "`create-poll` writes exactly TWO `audit_log` rows on the `results_hidden === true` path: one `poll_created` (always) and one `results_hidden_set_at_create` (only on the true path) — D-09"
    - "`create-poll` writes exactly ONE `audit_log` row on the `results_hidden === false` (or absent) path: `poll_created` only"
    - "`create-poll`'s response shape is unchanged (still returns the existing `{ poll: <row> }` or equivalent shape from the RPC)"
    - "No migration delta — Plan 01's migration 10 file stays UNTOUCHED (BLOCKER-2 fix)"
  artifacts:
    - path: "supabase/functions/create-poll/index.ts"
      provides: "Audit retrofit + results_hidden body extension via post-RPC conditional UPDATE pattern"
      contains: "results_hidden_set_at_create"
  key_links:
    - from: "create-poll/index.ts"
      to: "supabase/functions/_shared/audit.ts (Plan 02)"
      via: "import { writeAudit } from '../_shared/audit.ts'"
      pattern: "import \\{ writeAudit \\} from '\\.\\./_shared/audit\\.ts'"
    - from: "create-poll/index.ts"
      to: "polls.results_hidden column (migration 10)"
      via: "post-RPC conditional UPDATE on the inserted poll row"
      pattern: "results_hidden_changed_at"
---

<objective>
Extend `create-poll` to accept the optional `results_hidden?: boolean` body field per D-08/D-09/D-10 AND emit audit rows for poll creation, completing the 12th retrofit of the audit floor. This plan is split off from Plan 11-03 (BLOCKER-1) because the D-08/D-09/D-10 extension is non-trivial and benefits from its own plan boundary.

Locked design (BLOCKER-2 fix — Option A only): the `create_poll_with_choices` RPC signature is NOT modified, and Plan 01's migration 10 stays untouched. Instead, the EF relies on the `polls.results_hidden` column DEFAULT (false) added by migration 10 — the RPC INSERTs poll rows with the default. When the request body explicitly passes `results_hidden: true` (rare admin-bootstrapped poll), the EF issues a single post-RPC UPDATE to flip the flag and stamp `results_hidden_changed_at = now()`. Two audit rows are emitted on that path; one row otherwise.

Purpose: VIS-02 requires every change to write a new `audit_log` row. D-05 expands this to the full mutation surface (13 emitters total — 11 from Plan 11-03 + create-poll here + toggle-results-visibility from Plan 02). D-08/D-09/D-10 require `create-poll` to admit the `results_hidden` boolean and to record the bootstrap-hidden case in the audit trail. The Option A pattern preserves the RPC as the canonical poll-creation path and keeps Wave 1 (migration 10) and Wave 3 (this EF) on a clean one-directional dependency graph.

Output: One EF file modified (`supabase/functions/create-poll/index.ts`). Diff: ~35-55 lines (one new import, the `results_hidden` body validation, the post-RPC conditional UPDATE, two `writeAudit` calls). Zero changes to the response shape. Zero changes to migration 10, the RPC, validation/auth/CORS code, or any other EF.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/11-schema-rls-ef-foundations/11-CONTEXT.md
@.planning/phases/11-schema-rls-ef-foundations/11-RESEARCH.md
@.planning/phases/11-schema-rls-ef-foundations/11-PATTERNS.md

<!-- Plan 02 shared helper (this plan's primary dependency) -->
@supabase/functions/_shared/audit.ts
@supabase/functions/_shared/admin-auth.ts

<!-- Plan 01 output (the column DEFAULT this plan relies on — DO NOT MODIFY) -->
@supabase/migrations/00000000000010_results_hidden_audit.sql

<!-- The single file this plan modifies -->
@supabase/functions/create-poll/index.ts

<interfaces>
<!-- Body field validation (D-08, D-10) -->

Request body extension:
  Existing fields: { title, description?, choices, category_id, ...other existing fields }
  NEW optional field: results_hidden?: boolean
  Validation:
    - If body.results_hidden === undefined → resolved value is false (column DEFAULT covers it)
    - If typeof body.results_hidden === 'boolean' → resolved value is body.results_hidden
    - Otherwise → return 400 with { error: 'Invalid results_hidden' } (do not coerce strings/numbers)

<!-- Locked per-action shape for the two audit rows (PATTERNS.md "Audit retrofit" table, create-poll rows) -->

| action | target_type | actor_id | target_id | before | after | when emitted |
|--------|-------------|----------|-----------|--------|-------|--------------|
| poll_created | poll | user.id | new poll id (from RPC return) | null | { title, category_id, results_hidden } | ALWAYS on success |
| results_hidden_set_at_create | poll | user.id | same new poll id | null | { results_hidden: true } | ONLY when body.results_hidden === true (D-09) |

<!-- Sequence of operations (locked) -->

1. Existing admin gate (requireAdmin) — UNCHANGED
2. Existing body parse — UNCHANGED, plus the new typeof check for results_hidden
3. Existing RPC call to create_poll_with_choices — UNCHANGED signature; INSERTed poll uses column DEFAULT (results_hidden = false)
4. Check RPC error; on error, return existing error path UNCHANGED
5. NEW: if body.results_hidden === true:
     UPDATE polls SET results_hidden = true, results_hidden_changed_at = now() WHERE id = <newPollId>
     (use the existing supabaseAdmin service-role client; RLS bypassed as it is for all admin writes)
6. NEW: emit first audit row: writeAudit({ action: 'poll_created', ... after: { title, category_id, results_hidden: <resolved boolean> } })
7. NEW: if body.results_hidden === true (same gating condition as step 5):
     emit second audit row: writeAudit({ action: 'results_hidden_set_at_create', ... after: { results_hidden: true } })
8. Existing success return — UNCHANGED response shape
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 03b-01: create-poll results_hidden extension + audit retrofit (Option A, post-RPC conditional UPDATE)</name>
  <files>supabase/functions/create-poll/index.ts</files>
  <read_first>
    - supabase/functions/_shared/audit.ts (Plan 02 output — `writeAudit` signature + `AuditEntry` shape)
    - supabase/functions/_shared/admin-auth.ts (existing — confirms `requireAdmin` early-returns 403 on non-admin)
    - supabase/functions/create-poll/index.ts (full ~140 lines — the file this plan modifies; locate the body parser, the RPC call site, and the existing success return)
    - supabase/migrations/00000000000010_results_hidden_audit.sql (Plan 01 — confirms `results_hidden boolean NOT NULL DEFAULT false` and `results_hidden_changed_at timestamptz` columns exist on `polls`; the column DEFAULT is the foundation of Option A)
    - .planning/phases/11-schema-rls-ef-foundations/11-PATTERNS.md § "Audit retrofit of 12 existing EFs" → the create-poll rows ("create-poll (always)" + "create-poll (extra, D-09 ONLY when results_hidden=true)")
    - .planning/phases/11-schema-rls-ef-foundations/11-RESEARCH.md § "Pattern 3: create-poll audit + optional results_hidden extension" (full pattern, audit row ordering)
    - .planning/phases/11-schema-rls-ef-foundations/11-RESEARCH.md § "Pitfall 4: RPC must be extended, not bypassed" (this plan's locked answer: Option A — leave the RPC alone; the post-RPC UPDATE is GATED on the explicit boolean and does not run for the common false path)
    - .planning/phases/11-schema-rls-ef-foundations/11-CONTEXT.md § D-08, D-09, D-10 (create-poll extension contract); D-13 (`results_hidden_changed_at` written on every UPDATE)
  </read_first>
  <action>
    Modify `supabase/functions/create-poll/index.ts` in place. Six steps; each is small and additive.

    Step 1 — import the audit helper. Add `import { writeAudit } from '../_shared/audit.ts'` to the existing import block immediately after the `admin-auth` import. Do NOT touch other imports.

    Step 2 — body field validation (D-08, D-10). In the existing body parser block, AFTER the existing body-shape validation but BEFORE the RPC call, add the `results_hidden` resolver:
      `const results_hidden = body.results_hidden === undefined ? false : (typeof body.results_hidden === 'boolean' ? body.results_hidden : null);`
      `if (results_hidden === null) { return json({ error: 'Invalid results_hidden' }, 400, corsHeaders); }`
      Use the EF's existing `json` / `corsHeaders` helpers — do NOT introduce new response helpers. The local variable is named `results_hidden` (snake_case, matching the DB column and request field).

    Step 3 — RPC call UNCHANGED. Do NOT pass `results_hidden` into the RPC call. Do NOT modify the existing `supabaseAdmin.rpc('create_poll_with_choices', { ... })` argument shape. The poll row will INSERT with `results_hidden = false` from the column DEFAULT (BLOCKER-2: Option A locked). Add a brief WHY-only inline comment immediately above the RPC call: `// RPC signature unchanged — results_hidden uses column DEFAULT (migration 10); rare opt-in flip happens via post-RPC UPDATE below.` Do NOT cite plan IDs / round numbers / PR numbers in the comment (CLAUDE.md WHY-only policy).

    Step 4 — extract the new poll id from the existing RPC return path. The RPC currently returns the new poll row (or its id) — reuse the existing destructuring or response variable; do not add a separate SELECT.

    Step 5 — conditional UPDATE on the `results_hidden === true` path. AFTER the existing RPC error check (the `if (rpcError) { return json(...) }`) and BEFORE the audit emissions in Step 6, add:
      ```
      if (results_hidden === true) {
        const { error: updateError } = await supabaseAdmin
          .from('polls')
          .update({ results_hidden: true, results_hidden_changed_at: new Date().toISOString() })
          .eq('id', newPollId);
        if (updateError) {
          return json({ error: 'Failed to apply results_hidden at create' }, 500, corsHeaders);
        }
      }
      ```
      Use the EF's existing `supabaseAdmin` service-role client. Use `new Date().toISOString()` for the timestamp (deterministic from the EF; the column would also accept `now()` if passed via raw SQL, but the supabase-js update API does not interpret SQL functions in object values — ISO string is the correct shape). Do NOT change the response shape — only the polls row is mutated.

    Step 6 — emit the audit rows. AFTER Step 5's conditional UPDATE (so the audit reflects the row's final state) and BEFORE the existing success `return json(...)`, insert:
      ```
      await writeAudit(supabaseAdmin, {
        actor_id: user.id,
        action: 'poll_created',
        target_type: 'poll',
        target_id: newPollId,
        before: null,
        after: { title, category_id, results_hidden },
      });
      if (results_hidden === true) {
        await writeAudit(supabaseAdmin, {
          actor_id: user.id,
          action: 'results_hidden_set_at_create',
          target_type: 'poll',
          target_id: newPollId,
          before: null,
          after: { results_hidden: true },
        });
      }
      ```
      The first `writeAudit` is unconditional (always emitted on success). The second is gated on `results_hidden === true`. Do NOT wrap either call in try/catch (Pitfall 3). The `after` field of the first row reflects the RESOLVED boolean — true if the bootstrap flip happened, false otherwise; this matches the row's actual state.

    Step 7 — do NOT modify any of the following: the response shape (`json(...)` return body), the RPC signature, the existing validation, the existing admin gate, the existing CORS handling, the existing error paths. Do NOT add review-round / Plan / Round / PR archaeology in any comment.

    The total diff against the existing file should be approximately 35-55 lines added, zero lines removed (other than possibly tightening adjacent whitespace).
  </action>
  <acceptance_criteria>
    - File imports `writeAudit` from `_shared/audit.ts`: `grep -q "import.*writeAudit.*_shared/audit" supabase/functions/create-poll/index.ts` exits 0
    - File validates `results_hidden` as boolean OR returns 400: `grep -qE "typeof body\\.results_hidden === 'boolean'" supabase/functions/create-poll/index.ts` exits 0 AND `grep -qE "Invalid results_hidden" supabase/functions/create-poll/index.ts` exits 0
    - File contains the post-RPC conditional UPDATE on the polls table with `results_hidden_changed_at` stamped: `grep -E "results_hidden_changed_at" supabase/functions/create-poll/index.ts` returns ≥1 match (the EF previously had zero references to this column); the same match must be inside an `.update(` call shape:
      `awk '/\\.update\\(/{capture=1} capture{print; if (/\\)/) capture=0}' supabase/functions/create-poll/index.ts | grep -qE "results_hidden_changed_at"` exits 0
    - The conditional UPDATE is gated on `results_hidden === true`: `awk '/if\\s*\\(\\s*results_hidden\\s*===\\s*true\\s*\\)/{found=1} found && /\\.update\\(/{ok=1; exit} END{exit ok?0:1}' supabase/functions/create-poll/index.ts` exits 0 (the `.update(` appears inside the if-block following the strict-equality gate)
    - File contains EXACTLY two `await writeAudit(` calls: `grep -c "await writeAudit(" supabase/functions/create-poll/index.ts` returns 2
    - The two audit calls use the locked action strings, one each: `grep -cE "action:\\s*'poll_created'" supabase/functions/create-poll/index.ts` returns 1 AND `grep -cE "action:\\s*'results_hidden_set_at_create'" supabase/functions/create-poll/index.ts` returns 1
    - The second audit call is gated on `results_hidden === true` (the gating if appears in the 5 lines above the second writeAudit): `grep -B 5 "results_hidden_set_at_create" supabase/functions/create-poll/index.ts | grep -qE "if\\s*\\(\\s*results_hidden\\s*===\\s*true\\s*\\)"` exits 0
    - The RPC signature is UNCHANGED: `grep -E "create_poll_with_choices" supabase/functions/create-poll/index.ts` returns the same line count as pre-change (executor confirms via `git diff` that the RPC argument object did not gain a `results_hidden` / `p_results_hidden` key). A negative grep guards against accidental RPC extension: `grep -qE "create_poll_with_choices[^)]*results_hidden" supabase/functions/create-poll/index.ts` returns NON-zero (no match)
    - Migration 10 is UNTOUCHED: `git diff --name-only HEAD~1 -- supabase/migrations/00000000000010_results_hidden_audit.sql` returns an empty set (this plan introduces no migration delta)
    - Response shape is unchanged: `grep -c "json(" supabase/functions/create-poll/index.ts` returns the pre-change count + at most 1 (the 400 path for invalid results_hidden is the only new `json(` site)
    - No try/catch wraps either `writeAudit`: `grep -B 1 "writeAudit(" supabase/functions/create-poll/index.ts | grep -E "^\\s*try\\s*\\{$"` returns nothing
    - No review-round / phase-ID archaeology in the diff: `grep -iE "(Round [0-9]|Plan [0-9]+-[0-9]+|PR #[0-9]+|review-round|BLOCKER-)" supabase/functions/create-poll/index.ts` returns nothing
    - `npm run lint` exits 0
    - `npm run test` (unit suite) exits 0
    - Integration test scaffold exists (or is in this plan's read_first dependency Plan 04 for runtime verification): a deferred TEST-12-style integration assertion that creates a poll with `{results_hidden: true}` and asserts the resulting polls row has `results_hidden = true` AND two audit_log rows exist for the poll_id. The runtime assertion can land in Plan 04 (TEST-12 surface) — flag in this plan's SUMMARY which test file owns the runtime evidence.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "import.*writeAudit.*_shared/audit" supabase/functions/create-poll/index.ts && grep -qE "typeof body\\.results_hidden === 'boolean'" supabase/functions/create-poll/index.ts && grep -qE "results_hidden_changed_at" supabase/functions/create-poll/index.ts && test $(grep -c "await writeAudit(" supabase/functions/create-poll/index.ts) -eq 2 && grep -qE "action:\\s*'poll_created'" supabase/functions/create-poll/index.ts && grep -qE "action:\\s*'results_hidden_set_at_create'" supabase/functions/create-poll/index.ts && grep -B 5 "results_hidden_set_at_create" supabase/functions/create-poll/index.ts | grep -qE "if\\s*\\(\\s*results_hidden\\s*===\\s*true\\s*\\)" && ! grep -qE "create_poll_with_choices[^)]*results_hidden" supabase/functions/create-poll/index.ts && npm run lint 2>&1 | tail -3 && npm run test 2>&1 | tail -3</automated>
  </verify>
  <done>
    `create-poll` accepts the optional `results_hidden` body field with strict boolean type validation (else 400). The `create_poll_with_choices` RPC signature is unchanged and migration 10 is untouched. The EF runs a post-RPC UPDATE only when `results_hidden === true`, stamping `results_hidden_changed_at`. The EF emits exactly one `poll_created` audit row on every success, and a second `results_hidden_set_at_create` row only on the true path. No try/catch wraps either audit call. Response shape unchanged. Lint + unit suite green. Runtime evidence is provided by Plan 04's TEST-12 surface (or an explicit follow-up integration case) — flagged in this plan's SUMMARY.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Admin JWT → create-poll | Existing `requireAdmin` gate unchanged; new `results_hidden` validation runs AFTER the gate, before the RPC |
| EF body → polls row | New `results_hidden` field is strictly typed (boolean OR 400); no coercion of strings/numbers |
| RPC INSERT → conditional UPDATE | Post-RPC UPDATE happens AFTER the RPC succeeds, on the same row, via the same service-role client; RLS is enforced on the same row identity (id-eq filter) |
| EF success → audit_log | Both audit rows are emitted AFTER all mutations succeed; an unwritable audit must not be observable to the caller |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-VALIDATION-DRIFT | Tampering | `results_hidden` body field | mitigate | Strict `typeof body.results_hidden === 'boolean'` check before resolving; non-boolean → 400 with `{ error: 'Invalid results_hidden' }`. No coercion of strings ('true'), numbers (1), or null. Verified by acceptance criterion. |
| T-RPC-BYPASS | Tampering | create_poll_with_choices RPC integrity (Pitfall 4) | mitigate | Option A locked (BLOCKER-2): the RPC signature is unchanged; the column DEFAULT (migration 10) handles the common false path. The post-RPC UPDATE is GATED on `results_hidden === true` (executed only on the rare admin-bootstrapped opt-in path) and runs against the same row id returned by the RPC. Acceptance criterion `grep -qE "create_poll_with_choices[^)]*results_hidden"` returns non-zero, asserting the RPC payload did NOT gain a `results_hidden` argument. |
| T-MIGRATION-DRIFT | Tampering | Plan 01 migration 10 file | mitigate | Acceptance criterion verifies migration 10 is UNTOUCHED in this plan's diff. The Option B path (extend RPC signature in migration 10) is explicitly rejected by BLOCKER-2; no plan in Phase 11 modifies migration 10 after Plan 01. |
| T-AUDIT-DRIFT | Repudiation | Two audit rows on the true path | mitigate | The shared `writeAudit` helper from Plan 02 is the single emitter for all 13 audit sites. Locked action strings (`poll_created`, `results_hidden_set_at_create`) match the PATTERNS.md table verbatim. Acceptance criteria assert EXACTLY two `await writeAudit(` calls and one occurrence of each locked action string. |
| T-AUDIT-GATING-DRIFT | Repudiation | Second audit gating | mitigate | The second `writeAudit` is gated on the same `results_hidden === true` predicate as the post-RPC UPDATE. Acceptance criterion asserts the `if` is present in the 5 lines preceding the second `writeAudit`. Both gates use the resolved local `results_hidden` (the validated boolean), not `body.results_hidden` directly. |
| T-AUDIT-FAIL-OPEN | Repudiation | writeAudit helper error handling | accept | Per Pitfall 3, audit failure does not fail the user-facing mutation. Same disposition as Plans 02, 11-03. The helper logs to Supabase Function Logs on failure. |
| T-RESPONSE-SHAPE-DRIFT | Tampering | create-poll response shape | mitigate | Acceptance criterion: `grep -c "json("` returns the pre-change count + at most 1 (only the new 400 path for invalid `results_hidden`). The success-path `json(...)` return is byte-for-byte unchanged; Phase 12 admin UI continues to work. |
| T-RACE-MUTATION-AUDIT | Tampering | Audit emitted AFTER conditional UPDATE | mitigate | Audit rows are emitted AFTER the post-RPC UPDATE (when applicable) so the `after` field reflects the row's final state. The first row's `after.results_hidden` matches the RESOLVED local boolean — true if the bootstrap UPDATE ran, false otherwise. |
</threat_model>

<verification>
- `npm run lint` passes with zero new warnings
- `npm run test` (unit suite) passes
- Diff is small (~35-55 lines added): one import, one body-validation block, one inline WHY comment, one conditional UPDATE block, two `writeAudit` calls (the second inside an if). Zero lines removed (other than possibly tightening adjacent whitespace).
- Plan 04 (TEST-12) provides the closest runtime assertion surface; if Plan 04's existing 4 cases do not directly cover the `create-poll → { results_hidden: true }` path, the SUMMARY flags this as an "Open follow-ups" item (a fifth integration case in Plan 04, or a one-off scaffold reusing helpers).
- Plan 05's deploy task lists `create-poll` in the 12-EF deploy enumeration (no change required to Plan 05's deploy command list — `create-poll` is already in the loop).
</verification>

<success_criteria>
- VIS-02 partial coverage advanced from 11/13 (Plans 02 + 11-03) to 12/13 emitters live after this plan; only `toggle-results-visibility` (Plan 02) remains as the 13th, already covered.
- D-05 fully covered when combined with Plan 11-03 (12 of 12 mutation admin EFs retrofitted).
- D-08, D-09, D-10 fully covered (`create-poll` accepts `results_hidden`, dual audit rows on true-at-create, default false).
- TEST-12 surface partially advanced via the runtime evidence pointer; full TEST-12 coverage lands in Plan 04.
- Migration 10 untouched; Plan 01 stays clean.
- Plan 04 and Plan 05 update their `depends_on` to include this plan (handled in the revision's edits to those plans).
</success_criteria>

<output>
After completion, create `.planning/phases/11-schema-rls-ef-foundations/11-03b-SUMMARY.md` per `@$HOME/.claude/get-shit-done/templates/summary.md`. Declare `requirements-completed: [VIS-02 (partial — 12/13 emitters; combined with Plan 02 and Plan 11-03), D-08, D-09, D-10]`. Under "Open follow-ups": flag whether Plan 04 should grow a fifth integration case asserting the `create-poll → { results_hidden: true }` path produces both audit rows, or whether the deploy-time smoke in Plan 05 is sufficient.
</output>
</content>
</invoke>