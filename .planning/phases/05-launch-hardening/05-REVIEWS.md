---
phase: 5
reviewers: [codex]
reviewers_skipped: [claude (self — Claude Code CLI session), gemini (not installed), opencode (not installed), qwen (not installed), cursor (auth required — run `cursor agent login`), coderabbit (reviews git working tree, not committed plan artifacts)]
reviewed_at: 2026-04-19
plans_reviewed: [05-01-PLAN.md, 05-02-PLAN.md, 05-03-PLAN.md, 05-04-PLAN.md, 05-05-PLAN.md, 05-06-PLAN.md, 05-07-PLAN.md, 05-08-PLAN.md, 05-09-PLAN.md, 05-10-PLAN.md]
---

# Cross-AI Plan Review — Phase 5

## Runtime Notes

Only **codex** produced a review. Claude was skipped because this session IS Claude Code (self-review is not independent). Cursor needs `cursor agent login`. Gemini, OpenCode, and Qwen are not installed. CodeRabbit reviews the git working tree and the plans were already committed, so it would not diff anything.

To add a second independent review, run `cursor agent login` and re-invoke `/gsd-review --phase 5`, or install `gemini-cli`.

---

## Codex Review

## Summary

The Phase 5 plan set is strong overall: it is concrete, falsifiable, sequenced, and mostly aligned with the actual launch criteria. The best part is that it treats this as an infra/process hardening phase rather than pretending it is a feature phase. The main weaknesses are a few internal contradictions between plans, several execution details that are still underspecified or too optimistic, and one high-risk E2E auth approach that may fail in practice or create unnecessary complexity. The biggest operational risk is 05-08: cutover depends on multiple external systems, but the plan still mixes "documentation of a manual runbook" with "actually proving production works," and it leaves a few important gateway/auth details ambiguous.

## Strengths

- The wave structure is mostly sensible: `05-01` foundational pins/deps, `05-02/03/04` implementation, `05-05/06/07` automation, `05-08` cutover, `05-09/10` docs.
- The plans are unusually verifiable. Most tasks include grep-able acceptance criteria instead of hand-wavy "looks good."
- Supply-chain hardening is taken seriously where it matters most for this stack: `esm.sh` pinning in `05-02`, `npm ci` in CI/Netlify, and Dependabot in `05-07`.
- `05-07` correctly treats Dependabot as both dependency hygiene and cron-keepalive infrastructure. That is good systems thinking.
- `05-06` and `05-07` split CI, deploy, and cron instead of building one mega-workflow. That reduces blast radius and makes failures easier to reason about.
- `05-03` is explicit about privacy boundaries for PostHog and Sentry. The "Discord snowflake only" rule is the right bias.
- `05-04` explicitly guards against admin-route preload bugs. That is exactly the kind of subtle issue these launch phases usually miss.
- `05-08` captures the correct cutover ordering: deploy on Netlify first, dual-register redirects, then flip DNS.
- README/documentation scope in `05-10` is appropriate for a public repo and consistent with the product framing.

## Concerns

- **HIGH**: `05-03` and `05-04` conflict on router preload policy. `05-03 Task 2` sets `defaultPreload: 'intent'` app-wide, while `05-04` says Admin must stay cold and only explicitly overrides `preload={false}` in nav links. That does not guarantee admin routes never preload from other links or programmatic navigation. The plans disagree on the safe default.
- **HIGH**: `05-05 Task 1` proposes session minting via `admin.auth.admin.generateLink()` and parsing tokens out of the magic link. That is brittle and may not produce a valid browser session payload in the shape Supabase localStorage expects. This is the biggest technical execution risk in the whole phase.
- **HIGH**: `05-05` depends only on `[01, 03]`, but the E2E suite exercises admin-create and submit-response flows that likely depend on the exact EF behavior and pinned imports from `05-02`. It should depend on `02` too, or at least be explicit about what it assumes from prior phases.
- **HIGH**: `05-08` still leaves the cron auth contract ambiguous. It says to maybe add `Authorization: Bearer <ANON_KEY>` if needed. That is not acceptable at plan level for a launch-critical workflow. The EF gateway auth requirement must be resolved before implementation.
- **MEDIUM**: `05-01` includes a "typescript tilde exception," but the phase-level decision in D-16 says strip `^` and `~` for exact pins. That exception is either valid and should be elevated into canonical context, or it is a plan-local contradiction.
- **MEDIUM**: `05-01` requires `npx playwright install --with-deps chromium` locally. Installing OS deps is not portable and can fail outside CI. For a repo plan, browser install is fine; OS package installation on arbitrary developer machines is not a reliable acceptance criterion.
- **MEDIUM**: `05-03` adds both Sentry Replay and PostHog session recording on a mobile-first app. For a $0/mo product, that is a bundle-size and runtime-cost concern. The plan mentions privacy but not payload/perf budgets.
- **MEDIUM**: `05-03` initializes Sentry replay unconditionally in `main.tsx`. That may violate the intended "non-blocking consent chip" model if replay starts before opt-out state is known.
- **MEDIUM**: `05-06` seeds local Supabase by applying `e2e/fixtures/seed.sql` directly after `supabase start`, but it does not clearly establish whether base schema + base seed are already present or whether reset/migrations must run first. The sample YAML and narrative are inconsistent across docs.
- **MEDIUM**: `05-06` stores `LOCAL_ANON_KEY` and `LOCAL_SERVICE_ROLE_KEY` as GitHub secrets even though they are deterministic local defaults. That is harmless, but unnecessary complexity for a zero-budget repo.
- **MEDIUM**: `05-08` marks itself `autonomous: false`, which is correct, but it is doing too much: Netlify config, SaaS account creation, env/secrets provisioning, Supabase config, Discord app config, DNS cutover, prod smoke, cron verification, and rerunning blocked UAT. That is operationally dense and failure-prone.
- **LOW**: `05-09` asks for a git commit inside a human-action checkpoint. That is awkward if these plans are being executed as part of a larger branch/PR rather than individually.
- **LOW**: `05-10` hardcodes version examples in README. That will drift quickly unless generated or carefully maintained.

## Suggestions

- `05-03 Task 2` / `05-04 Task 2`: remove app-wide `defaultPreload: 'intent'` entirely and keep preload explicit on allowed links only. That is simpler and avoids the admin-route contradiction. If you want invisible preload globally later, do it after admin route guards are proven preload-safe.
- `05-05 Task 1`: replace the magic-link token parsing approach with a simpler, deterministic auth fixture strategy.
  - Best option: seed users with known email/password and use the public auth API to sign in in the helper, then inject the returned session.
  - Better option if supported cleanly: use a test-only helper/RPC in local dev only.
  - Avoid parsing tokens out of URLs.
- `05-05`: add dependency on `05-02`, or explicitly state the suite assumes all prior EF code paths are already stable from Phase 4 and `05-02` is non-functional pinning only.
- `05-05 Task 2`: do not rely on speculative selectors like `role="progressbar"` or `data-testid="suggestion-card"` unless those hooks already exist. Add a pre-task to inspect actual DOM affordances and define stable selectors. Otherwise this suite will be noisy from day one.
- `05-06 Task 1`: make the DB setup path explicit and single-source.
  - Either `supabase db reset --local` then apply additive E2E seed.
  - Or rely on `supabase start` bootstrapping migrations + `supabase/seed.sql`, then apply only additive E2E fixtures.
  - Do not leave both models floating around.
- `05-06 Task 1`: use the known local Supabase anon/service-role keys directly in workflow env or derive them from `supabase status` output. Repo secrets are unnecessary here.
- `05-07 Task 2`: resolve now whether the cron request requires `Authorization: Bearer <anon key>`. This should be decided in the plan, not discovered during launch. If needed, add `SUPABASE_ANON_KEY` to GitHub secrets and `.env.example`/README contracts consistently.
- `05-07 Task 2`: add explicit response-body validation for a known success shape, not just HTTP 200. A misconfigured function can still 200 with the wrong behavior.
- `05-08`: split this into two plans or at least two checkpoints in execution terms:
  - provisioning and preview verification
  - DNS/OAuth cutover and production verification
  This phase is otherwise too operationally dense for one plan.
- `05-08 Task 5`: add rollback instructions.
  - If Discord callback fails after CNAME flip, what exact steps revert traffic?
  - If Netlify cert stalls, what is the temporary safe state?
  A launch plan without rollback is incomplete.
- `05-03`: gate session replay behind consent state or at minimum defer replay start until dismissal/opt-out state is loaded. The current plan reads like replay is active immediately and only later opt-out is offered.
- `05-03`: add a lightweight bundle/perf verification step, at least `npm run build` artifact size comparison or a threshold note, because Sentry + PostHog on a mobile-first app is non-trivial.
- `05-01`: resolve the TypeScript pin contradiction in canonical docs. If `~6.0.2` is allowed, D-16 and the must-have truth should say so globally, not only in one task.
- `05-10`: keep README version numbers high-level unless there is a process to update them during dependency bumps. Otherwise the doc will decay.

## Risk Assessment

**Overall risk: MEDIUM**

The plans are good enough to succeed, but not low risk. The core launch goals are covered: cron keepalive, custom-domain SPA deployment, admin-create to public visibility, and Playwright smoke in CI. What keeps this from LOW risk is execution ambiguity in the hardest parts:

- the E2E auth/session-injection method is not yet robust,
- the preload strategy is internally inconsistent,
- the cron auth contract is still not fully resolved before cutover,
- and the production cutover plan is operationally dense without explicit rollback.

If those are tightened, the phase drops to LOW-MEDIUM. Without fixing them, the most likely failure mode is not "bad architecture," it is "launch-week integration churn."

---

## Consensus Summary

Only one independent reviewer (codex). Treat this as a single critique, not consensus. Codex rated the plan set **MEDIUM risk overall** — success-capable, but with four HIGH-severity items worth addressing before `/gsd-execute-phase 5`.

### Top Concerns (HIGH severity — Codex)

1. **Preload policy contradiction between 05-03 and 05-04.** `defaultPreload: 'intent'` app-wide vs. per-link `preload={false}` on Admin is not airtight. Codex suggests dropping the app-wide default and using explicit `preload="intent"` only on Topics/Archive.
2. **Playwright session-injection via `generateLink` URL parsing is brittle.** Codex suggests seeding fixture users with known email/password and signing in via the public auth API, or adding a test-only local RPC.
3. **Cron auth contract unresolved.** 05-07 Task 2 / 05-08 leaves `Authorization: Bearer <ANON_KEY>` as "if needed." Should be decided in planning — if needed, add `SUPABASE_ANON_KEY` to GH secrets and `.env.example` consistently.
4. **05-05 missing dependency on 05-02.** E2E suite exercises flows served by the pinned EFs; dependency should be explicit or the suite should document that the pin sweep is non-functional.

### Noteworthy MEDIUMs

- Sentry Replay + PostHog session recording on mobile-first — no bundle-size/perf budget stated.
- Sentry Replay starts before consent state is known — possibly violates UI-SPEC Contract 3 intent.
- 05-01 typescript `~6.0.2` exception contradicts D-16 §1 (should lift to canonical or remove).
- 05-06 seed flow ambiguity (`supabase db reset` vs. implicit bootstrap).
- 05-08 is operationally dense — Codex suggests splitting into "provisioning + preview" and "DNS/OAuth cutover + prod".
- 05-08 missing rollback runbook (Discord callback fail, Netlify cert stall).
- 05-05 uses speculative DOM selectors that may not exist yet.

### Strengths Codex Flagged

- Wave structure, separate CI/deploy/cron workflows, grep-verifiable acceptance criteria, esm.sh + `npm ci` + Dependabot triad, Dependabot doubling as GH Actions keepalive, PostHog/Sentry snowflake-only identify, admin-preload guard in 05-04, correct cutover ordering in 05-08, README scope.

### Divergent Views

Not applicable — single reviewer.

### Recommendation

The four HIGH concerns are legitimate and worth a `/gsd-plan-phase 5 --reviews` pass before execution — especially the preload policy, the Playwright auth technique, and the cron auth contract (all three decide concrete code that lands in Wave 1–2 and is hard to change later). The 05-08 density + missing rollback is a smaller-but-real fix. Alternatively, accept the risk and let the executor discover and patch during Wave 1 — Codex argues against that path, and I agree for the Playwright + cron-auth items specifically.

---

*Generated by `/gsd-review --phase 5 --all` on 2026-04-19*
