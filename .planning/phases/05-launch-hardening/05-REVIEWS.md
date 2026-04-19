---
phase: 5
round: 2
reviewers: [codex, cursor]
reviewers_skipped: [claude (self — Claude Code CLI), gemini/opencode/qwen (not installed), coderabbit (reviews git diff, plans are committed)]
reviewed_at: 2026-04-19
plans_reviewed: [05-01-PLAN.md, 05-02-PLAN.md, 05-03-PLAN.md, 05-04-PLAN.md, 05-05-PLAN.md, 05-06-PLAN.md, 05-07-PLAN.md, 05-08-PLAN.md, 05-09-PLAN.md, 05-10-PLAN.md]
previous_review_round: round 1 (codex only) — see git history for commit 7bdff09
---

# Cross-AI Plan Review — Phase 5 (Round 2, post-revision)

This is a **revision review** — plans were updated via `/gsd-plan-phase 5 --reviews` to address round-1 codex feedback. Reviewers were asked to verify each prior HIGH/MEDIUM concern was actually resolved AND to flag any new concerns the revisions introduced.

---

## Codex Review

### 1. Resolution Audit

**HIGH**

- `05-03` / `05-04` preload-policy contradiction: **RESOLVED**. The revised plan removes app-wide `defaultPreload` in `05-03` and verifies its absence (`05-03-PLAN.md:24-27`, `84-90`, `300-303`, `458-460`). `05-04` now makes Topics/Archive explicit `preload="intent"` links and requires Admin to have no preload attribute at all, with tripwires for both nav files plus `src/main.tsx` (`05-04-PLAN.md:19-21`, `54-58`, `200-207`, `237-249`). Validation maps both checks (`05-VALIDATION.md:54`, `56`).
- `05-05` magic-link / `generateLink()` auth helper brittleness: **PARTIALLY RESOLVED**. The plan clearly switches to `signInWithPassword` and bans `generateLink|magicLink|SUPABASE_SERVICE_ROLE_KEY` in the helper (`05-05-PLAN.md:23-28`, `80-85`, `180-245`, `297-323`; `05-VALIDATION.md:58`). But it still does not verify that the injected localStorage payload is actually accepted by the app in a real authenticated run; acceptance only checks greps and `playwright test --list`, not a working login path (`05-05-PLAN.md:318-323`, `490-505`).
- `05-05` missing dependency on `05-02`: **RESOLVED**. `depends_on` now includes `02` (`05-05-PLAN.md:6`) and the objective explicitly calls that out as the codex resolution (`05-05-PLAN.md:87-89`).
- `05-08` cron auth contract ambiguous: **RESOLVED**. `05-07` now specifies both headers, explains why `Authorization: Bearer ${SUPABASE_ANON_KEY}` is required, validates `"success":true` and `"swept"`, and verifies those conditions in acceptance criteria and validation (`05-07-PLAN.md:19-20`, `62-80`, `203-208`, `230-245`, `266-284`; `05-VALIDATION.md:62`). `05-01`, `05-08`, and `05-10` propagate `SUPABASE_ANON_KEY` consistently.

**MEDIUM**

- TypeScript `~` pin exception: **RESOLVED** (`05-01-PLAN.md:18, 117-129, 141-143`).
- `npx playwright install --with-deps` portability: **RESOLVED** — now advisory locally, CI is source of truth.
- Sentry Replay + PostHog payload/perf budget: **PARTIALLY RESOLVED**. Adds lazy replay and a 400 KB budget (`05-03-PLAN.md:24-25, 34, 86-92, 413-421, 445-468`). **But the stated metric is "gzipped" while the command measures raw file size with `du`** — the budget is not being verified as described.
- Sentry Replay pre-consent: **RESOLVED**. Replay removed from `Sentry.init`, moved to lazy loader, guarded by `analytics_opted_out`.
- `05-06` seed-flow ambiguity: **RESOLVED**. Canonical two-step flow with acceptance ordering check.
- `05-06` local keys as GH secrets: **RESOLVED**. Derived from `supabase status --output json`; tripwires ban `LOCAL_*` secrets.
- `05-08` operationally dense cutover: **PARTIALLY RESOLVED**. Adds preview checkpoint + rollback runbook, but still one large plan covering provisioning → preview → DNS → cert → prod smoke → cron → UAT reruns.

### 2. New Concerns Introduced by Revisions

- **MEDIUM:** `05-05` claims Playwright config has `storageState` auth fixture, but the shown config does not set `storageState`, and acceptance downgrades to `storageState OR webServer`. Internal contradiction (`05-05-PLAN.md:22, 31-32, 118-140, 299-300`).
- **MEDIUM:** The auth-helper plan contradicts itself on storage-key discovery. Objective says `loginAs` "must read the ref from the running app's storage once" (`73-78`), but implementation derives it from `new URL(SUPABASE_URL).hostname.split('.')[0]` (`197-201`). Still fragile.
- **MEDIUM:** Bundle-budget verification is mislabeled — plan says "400 KB gzipped" but `du` measures uncompressed disk size. May reject acceptable builds or miss real transfer-size regressions.
- **MEDIUM:** `05-08` sequencing contradiction. Objective says env/secret provisioning must happen before Netlify site link (`68-70`), but Task 3 begins by linking/importing the site and only then adds env vars (`197-213`). Netlify import can trigger an initial build immediately.
- **LOW-MEDIUM:** `05-04`/`05-05` rely on "document in the commit message" for selector choices. Weak operational coupling; the contract should live in the plan or code.
- **LOW-MEDIUM:** `05-07` response validation greps exact `"success":true`. If the function returns `"success": true` (with whitespace), the workflow falsely fails.

### 3. Updated Risk Assessment

**MEDIUM** — lower than prior MEDIUM but not LOW. Four prior HIGH issues are mostly addressed; only Playwright auth is not fully closed because it is not end-to-end verified. Remaining risk is execution-risk from new contradictions: `storageState` mismatch, heuristic storage-key derivation, fake "gzipped" budget measurement, and the Netlify link-before-env sequencing bug.

### 4. Final Go/No-Go

**No-go for execution as written.** One more planning pass is warranted. The revised set is materially better, but still has avoidable failure points: Playwright auth injection is still not proven, the `storageState` contract is inconsistent, the bundle budget check is measuring the wrong thing, and `05-08` contradicts itself on Netlify sequencing. Tighten those and it is execute-ready.

---

## Cursor Review

### 1. Resolution Audit

**HIGH concerns**

- **H1: 05-03 vs 05-04 preload contradiction** — **RESOLVED**. `05-03` forbids app-wide `defaultPreload` with tripwire on `src/main.tsx` (`26, 84, 303, 458`). `05-04` sets `preload="intent"` only on Topics/Archive; Admin link has no preload attr (`200-204, 238-243`). Validation cross-checks both (`05-VALIDATION.md:54, 56, 95`).
- **H2: brittle Playwright auth via `generateLink` URL parsing** — **RESOLVED**. `signInWithPassword` + `addInitScript` (`23, 56, 83, 220`). Negative tripwires ban `generateLink|magicLink` and service-role in helper (`28, 303-304, 322`). Validation row encodes same checks.
- **H3: 05-05 missing dependency on 05-02** — **RESOLVED**. `depends_on` includes `02` (`05-05-PLAN.md:6`); rationale called out explicitly.
- **H4: cron auth contract ambiguous ("maybe Bearer")** — **RESOLVED**. Both headers mandated (`X-Cron-Secret` + `Authorization: Bearer ${SUPABASE_ANON_KEY}`). Response-shape validation for `"success":true` and `"swept"`. Propagated to env/secrets docs.

**MEDIUM concerns**

- **M1: TypeScript tilde exception** — **RESOLVED**. Must-have now says zero `^`/`~` including TypeScript. Tripwire specifically checks no `~` on TypeScript.
- **M2: local `playwright install --with-deps` portability** — **RESOLVED**. `--with-deps` optional locally; CI source of truth.
- **M3: Sentry+PostHog perf/bundle budget** — **PARTIALLY RESOLVED**. 400 KB budget + verification command present, code-splitting via dynamic replay import. **But command uses `du` on built JS, not gzipped size**, despite plan claiming "gzipped".
- **M4: Replay initialized before consent known** — **PARTIALLY RESOLVED**. Replay removed from `Sentry.init`, moved to lazy loader, opt-out localStorage gate exists. **But fresh users are still replay-enabled on mount before explicit action** — opt-out gating, not true consent gating. (Note: this matches UI-SPEC Contract 3 by design, so it's a policy question not a bug.)
- **M5: 05-06 seed flow ambiguous** — **RESOLVED**. Canonical two-step flow with ordering acceptance check.
- **M6: unnecessary GH secrets for local keys** — **RESOLVED**. Keys derived from `supabase status --output json`; tripwires ban `LOCAL_ANON_KEY`/`LOCAL_SERVICE_ROLE_KEY` refs.
- **M7: 05-08 operational density / missing rollback** — **PARTIALLY RESOLVED**. Preview dry-run `Task 5a` + rollback contingencies A/B added. Still one dense human-run plan, reduced but not truly decomposed.

### 2. New Concerns Introduced by Revisions

- **Bundle metric is mislabeled and likely inaccurate** (new). `05-03` claims "gzipped ≤ 400 KB" but computes raw file size with `du` — can create false pass/fail signals.
- **Consent model remains opt-out, not explicit opt-in**. Replay loads on mount for non-opted-out users. If regulatory/product intent shifts toward explicit consent, this plan won't satisfy it. (Note: aligns with UI-SPEC Contract 3 intent.)
- **E2E fixture password committed in plaintext constant** — local-only and hashed in SQL, but still a committed reusable password string. Low practical risk.
- **Selector strategy still leaves executor-choice forks** — `05-04` allows multiple outcomes for ResultBars/admin selectors and depends on commit-message coordination. Non-deterministic handoff risk.
- **README hardcodes dependency versions again** (prior LOW drift risk persists).

### 3. Updated Risk Assessment

**MEDIUM** (improved from prior MEDIUM, still MEDIUM). All 4 HIGH issues are concretely addressed with acceptance tripwires; most MEDIUMs resolved. Remaining risk is execution-quality risk: inaccurate perf budget check, opt-out replay semantics ambiguity, still-dense cutover plan.

### 4. Final Go/No-Go

**Go, with guardrails.** Revision is materially stronger and fixes the prior launch-blocking ambiguities. Execute with two pre-execution tighten-ups: (1) fix the bundle check to measure actual gzip/brotli artifacts, and (2) explicitly confirm whether "opt-out replay on first visit" is acceptable policy. If those two are acknowledged, execution-ready.

---

## Consensus Summary

**Two independent reviewers (codex + cursor)** — actual consensus this round.

### Agreed RESOLVED (strong consensus)

- ✓ Preload policy (HIGH #1)
- ✓ 05-05 depends_on (HIGH #4)
- ✓ Cron auth contract (HIGH #3)
- ✓ TypeScript pin exception
- ✓ `npx playwright install --with-deps` portability
- ✓ Sentry Replay moved out of init (the mechanism)
- ✓ 05-06 seed flow canonical
- ✓ 05-06 local keys derived from supabase status

### Agreed PARTIALLY RESOLVED (both reviewers flagged the same gap)

1. **Bundle budget mismatch (HIGH-priority fix).** Plan claims "400 KB gzipped" but verification uses `du` on uncompressed JS. Both reviewers flagged this as a material defect. One-line fix: replace `du -ck dist/assets/*.js` with a real gzip size measurement (e.g., `find dist/assets -name '*.js' -exec gzip -c {} \; | wc -c`, or use `vite-plugin-compression` output, or a jq-friendly `vite build` reporter option).
2. **Playwright auth not end-to-end verified.** The helper is grep-verified but the plan does not prove an injected session actually logs in. Codex calls this unresolved; cursor calls it resolved-by-mechanism. Fix: add an acceptance criterion that boots the app headlessly, runs the helper, and asserts an authenticated DOM state (e.g., the user menu renders).
3. **05-08 still dense** — both flagged, both stopped short of calling it blocking.

### New Concerns Codex Raised (cursor did not)

- **05-05 `storageState` contradiction** — plan objective says storageState is configured, but the shown config doesn't set it, and acceptance downgrades to "storageState OR webServer". One-line fix: pick one.
- **`loginAs` storage-key derivation contradiction** — objective says "read ref from running app's storage once"; implementation uses `URL.hostname.split('.')[0]`. Reconcile to a single method.
- **05-08 Netlify link-before-env sequencing bug** — objective says env/secrets first, Task 3 links the site first. Netlify's auto-build-on-import could fire before env vars are set. Reorder Task 3 steps.
- **`05-07` response grep fragile to whitespace.** `grep -q '"success":true'` fails on `"success": true`. Fix: use `jq -e '.success == true'`.

### New Concerns Cursor Raised (codex did not)

- **Consent model is opt-out not opt-in** — matches UI-SPEC Contract 3 by design; policy decision, not a bug. Only a concern if product/regulatory intent shifts. Recommend acknowledging explicitly in CONTEXT.md addendum or accept as-is.
- **Fixture password plaintext committed** — low risk, local-only. Acknowledge in plan.

### Divergent Verdicts

- **Codex: No-go.** Wants another planning pass before execution.
- **Cursor: Go with guardrails.** Wants the bundle-budget fix + consent-model confirmation, then execute.

Both agree the remaining items are small and surgical — not architectural. The divergence is whether "small and surgical" is worth another planning round (codex) or can be handled by a 10-minute targeted edit pass (cursor).

### Updated Overall Risk

**MEDIUM (lower than round 1).** Down from round 1's MEDIUM but not LOW. If the 4 codex-specific issues (bundle method, storageState, loginAs ref, Netlify sequencing, response grep) + the shared bundle-budget issue are fixed in a quick targeted pass, drops to LOW-MEDIUM.

---

## Recommended Next Step

Two viable paths:

### Path A — Quick targeted patch (cursor's lean, 10-min edit)

Apply these 5 surgical fixes directly to the plans without a full `/gsd-plan-phase --reviews` pass:

1. **05-03:** Replace `du` bundle-size command with a real gzip measurement.
2. **05-05:** Pick `storageState` OR `webServer`-only and make config + acceptance consistent.
3. **05-05:** Reconcile `loginAs` storage-key discovery — either "read from app" OR "derive from URL" (not both).
4. **05-07:** Replace `grep '"success":true'` with `jq -e '.success == true'`.
5. **05-08:** Reorder Task 3 — Netlify env vars before site link.

Then proceed to `/gsd-execute-phase 5`.

### Path B — Full re-plan (codex's lean)

`/gsd-plan-phase 5 --reviews` again. Higher thoroughness, lower speed. Planner context is reloaded fresh.

My recommendation: **Path A.** All five items are mechanical text edits with no design trade-off. A full replan would re-read 200 KB of plan text to fix one-liners. That's the wrong tool for this job.

---

*Generated by `/gsd-review --phase 5 --all` (round 2) on 2026-04-19.*
*Round 1 review preserved in git history at commit `7bdff09`.*
