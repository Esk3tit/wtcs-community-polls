---
phase: 1
reviewers: [codex]
reviewed_at: "2026-04-06T21:30:00.000Z"
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 1

## Codex Review

**Model:** GPT-5.4 via Codex CLI 0.118.0

### Overall
The phase is well-scoped at a roadmap level: infrastructure, schema, auth, shell, and tests are the right slices for Phase 1. The main weakness is that several plans look stronger on paper than they are in execution detail. The biggest risks are a build-path issue around `routeTree.gen.ts`, an admin seeding approach that does not actually satisfy the requirement cleanly, a potentially bypassable 2FA flow, and tests that mostly validate mocks rather than the app's behavior. As written, the plans are close, but not yet reliable enough to call low-risk.

---

### Plan 01: Project Infrastructure Setup

#### Summary
This plan covers the right foundation work and has good acceptance criteria, but it has one important build-order problem and a few places where the implementation details are too optimistic. It should leave the repo in a useful state, but it may fail in CI or on clean checkouts unless the route-generation workflow is tightened up.

#### Strengths
- Clear objective and artifact list.
- Correctly prioritizes Vite, Tailwind v4, TanStack Router, Vitest, env template, and Netlify routing.
- Good callout on plugin ordering for TanStack Router before React.
- Includes acceptance criteria tied to concrete files and commands.
- Keeps scope bounded to tooling rather than drifting into app logic.

#### Concerns
- `HIGH`: `src/routeTree.gen.ts` is planned to be gitignored, but Plan 03 imports it in `src/main.tsx` and the build command runs `tsc -b` before `vite build`. `tsc` will fail on a clean checkout if the file is not already generated.
- `MEDIUM`: The plan assumes the exact router plugin API name (`TanStackRouterVite`) without confirming it against the installed version. That is brittle.
- `MEDIUM`: `components.json` does not actually encode the Maia theme preset. The plan says "Maia/Neutral preset" but the file only captures `new-york` + `neutral`.
- `LOW`: Adding `.env` to `.gitignore` is fine, but some teams want `.env.example` plus optional checked-in non-secret `.env`. Not a problem, just a policy choice.

#### Suggestions
- Commit `src/routeTree.gen.ts`, or add an explicit prebuild/pretypecheck route-generation step before `tsc`.
- Verify the actual TanStack Router Vite plugin API for the chosen version before locking the code snippet.
- Separate "shadcn initialized" from "Maia tokens applied"; treat the latter as a CSS/theme acceptance item, not something `components.json` proves.
- Add a verification step that a fresh clone can run `npm run build` without manual route generation.

#### Risk Assessment
**MEDIUM**. Good structure, but the `routeTree.gen.ts` issue is a real blocker if not fixed.

---

### Plan 02: Database Schema and Migrations

#### Summary
This plan has strong intent and good schema coverage, but it has several design gaps that will matter later: the admin seed strategy is not actually robust, the vote schema allows inconsistent data, and the trigger strategy assumes supporting behavior that is not yet guaranteed. It is directionally right, but not fully production-safe.

#### Strengths
- Full schema upfront matches the phase decision and reduces future churn.
- Good use of explicit constraints, indexes, and named uniqueness constraints.
- RLS-first mindset is correct.
- Vote-count aggregation table is a sensible optimization for later phases.
- Clear policy that browser reads use RLS and writes stay out of direct client access.

#### Concerns
- `HIGH`: The admin seed approach does not cleanly satisfy `ADMN-01`. The "pre-insert admin profiles" idea conflicts with `profiles.id REFERENCES auth.users(id)`, because you do not know the auth UUID before login.
- `HIGH`: `votes` does not enforce that `choice_id` belongs to the same `poll_id`. A user could theoretically submit a mismatched `(poll_id, choice_id)` pair unless later server logic prevents it perfectly.
- `MEDIUM`: `increment_vote_count()` only updates an existing `vote_counts` row. If the row is not pre-created for each choice, counts will silently fail to increment.
- `MEDIUM`: `handle_new_user()` depends on assumed Discord metadata keys that may not match actual Supabase user metadata shape.
- `MEDIUM`: The plan says "no UPDATE policies" as a hard rule, but Plan 03 later needs profile updates for `mfa_verified`. That is a cross-plan inconsistency.
- `LOW`: No `updated_at` maintenance trigger for mutable tables. Not required for Phase 1, but the schema suggests those columns should stay accurate.

#### Suggestions
- Replace admin seeding with one of these:
  - a dedicated `admin_discord_ids` seed table keyed by Discord ID, with admin status derived on login, or
  - a post-login promotion migration/script that explicitly updates existing profiles by Discord ID.
- Add a database constraint or trigger ensuring `votes.choice_id` belongs to `votes.poll_id`.
- Ensure `vote_counts` rows are created when choices are created, or make the increment trigger upsert instead of update-only.
- Treat metadata extraction in `handle_new_user()` as best-effort only; keep the callback/profile sync as the source of truth.
- Resolve the Plan 02 vs Plan 03 write-policy conflict before implementation.

#### Risk Assessment
**HIGH**. The schema is close, but the admin seeding flaw and missing poll-choice integrity check are significant.

---

### Plan 03: Auth Infrastructure and App Shell

#### Summary
This is the most important plan in the phase and also the riskiest. It covers the right surfaces, but the current auth design has a fail-open path on 2FA, relies on uncertain provider-token behavior, and duplicates auth subscriptions across the app. The UI shell work is fine; the auth flow needs tightening.

#### Strengths
- Good separation of concerns across client, hook, layout, routes, and guards.
- Right focus on callback-time 2FA verification.
- Good alignment with the mobile-first shell and copy/tone requirements.
- Keeps admin UI hidden from normal navigation.
- Route breakdown is sensible and matches the phase boundary.

#### Concerns
- `HIGH`: The callback effectively fails open. If `provider_token` is missing or Discord API lookup fails, the user still proceeds. That violates `AUTH-02`.
- `HIGH`: The plan relies on `session.provider_token` being available in the callback flow even though the research explicitly marks that as an open question.
- `HIGH`: The proposed fix for profile updates adds a broad self-update RLS policy to `profiles`, which weakens the earlier "no writes from browser" stance and expands client write surface.
- `MEDIUM`: `useAuth()` is a plain hook, not a shared provider/context. If used in navbar, guards, and pages, it creates multiple Supabase subscriptions and redundant profile fetches.
- `MEDIUM`: `fetchProfile()` ignores errors and race conditions. A missing profile row or delayed trigger can produce confusing state.
- `MEDIUM`: The plan deletes `src/App.tsx` while relying on route generation/build steps that are already fragile in Plan 01.
- `LOW`: ThemeProvider does not react to system-theme changes after mount when `theme === 'system'`.

#### Suggestions
- Make 2FA enforcement fail closed:
  - if `provider_token` is missing, or
  - if Discord `/users/@me` fails, or
  - if `mfa_enabled` is missing/false,
  then reject login and show a clear error.
- Prove the provider-token behavior with a spike before treating this plan as executable. If it does not work in PKCE, revise the auth design first.
- Replace `useAuth()`-everywhere with an `AuthProvider` plus `useAuth()` context consumer.
- Avoid general client-side profile update access. Prefer:
  - an RPC/Edge Function for profile sync, or
  - a very narrow database mechanism designed specifically for callback-time profile completion.
- Add explicit handling for "profile row not found yet" after first login.

#### Risk Assessment
**HIGH**. This plan can miss the phase goal if the provider token is unavailable or if 2FA is bypassable.

---

### Plan 04: Testing and Human Verification

#### Summary
The testing plan is the weakest part of the set. It creates files and assertions, but many of the tests do not actually exercise the app code they claim to validate. As written, it gives a false sense of coverage for the auth flow.

#### Strengths
- Correct test categories for the phase: login, MFA rejection, session persistence, logout, theme behavior, auth error UI.
- Good instinct to mock Supabase and avoid real network calls in unit tests.
- Includes a smoke test and CI-friendly `vitest run` flow.
- Human verification step is useful for the OAuth path.

#### Concerns
- `HIGH`: Several tests only call mocked Supabase methods directly instead of testing `useAuth`, the callback route, or rendered components. That does not validate the app logic.
- `HIGH`: `mfa-check.test.ts` only tests a mocked `fetch()` payload, not the callback page's redirect/signout/update behavior.
- `HIGH`: `session.test.ts` and `logout.test.ts` mostly verify the mock contract, not state transitions in the hook or UI.
- `MEDIUM`: There is no real test of route behavior for authenticated vs unauthenticated states.
- `MEDIUM`: There is no test covering the critical fail-closed requirement when provider token is missing or Discord API errors.
- `LOW`: Theme tests validate ThemeProvider internals, but not the actual navbar theme control.

#### Suggestions
- Replace direct-SDK-call tests with behavioral tests:
  - render a hook test for `useAuth()`,
  - render the callback route with mocked Supabase + mocked navigate,
  - assert redirect/error behavior for missing token, false `mfa_enabled`, and success.
- Add a test for `AuthGuard` and `AdminGuard`.
- Add a test that `LandingPage` button invokes `signInWithDiscord()`.
- Add a test that navbar sign-out triggers `signOut()` and that admin nav remains hidden for non-admin users.
- Treat real OAuth verification as manual only, but make unit tests validate your code paths, not the SDK's methods.

#### Risk Assessment
**HIGH**. The planned tests do not currently prove the required behaviors.

---

## Consensus Summary

*Single reviewer (Codex/GPT-5.4) — consensus derived from cross-plan analysis.*

### Agreed Strengths
- Phase decomposition is sensible — infrastructure, schema, auth, shell, tests are the right slices
- Good alignment with user decisions (D-01 through D-20) and mobile-first requirements
- RLS-first security mindset is correct
- Acceptance criteria are tied to concrete files and commands

### Agreed Concerns
1. **2FA enforcement fails open** (HIGH) — If `provider_token` is missing or Discord API fails, user proceeds. Violates AUTH-02.
2. **Provider token availability unresolved** (HIGH) — Research marks this as open question, but plan depends on it without fallback.
3. **Admin seeding conflicts with FK constraint** (HIGH) — Cannot pre-insert profiles when auth UUID is unknown before login.
4. **Tests validate mocks, not app behavior** (HIGH) — Tests call SDK methods directly instead of exercising hooks/components.
5. **routeTree.gen.ts build-path issue** (HIGH) — File is gitignored but required by tsc on clean checkout.
6. **Cross-plan write policy inconsistency** (MEDIUM) — Plan 02 says "no client writes" but Plan 03 needs profile self-update RLS.
7. **useAuth() subscription duplication** (MEDIUM) — Multiple instances create redundant Supabase subscriptions.
8. **vote_counts rows not pre-created** (MEDIUM) — Increment trigger silently fails if rows don't exist.

### Divergent Views
*N/A — single reviewer. Recommend adding Gemini CLI for a second perspective.*

### Recommended Cross-Plan Fixes
1. **Resolve route generation/build path** — Either commit `routeTree.gen.ts` or add explicit generation step before `tsc`
2. **Redesign admin seeding** — Use dedicated admin Discord ID list, derive admin status on login
3. **Tighten 2FA enforcement** — Fail closed on missing/failed provider token
4. **Unify auth state** — Use AuthProvider context instead of multiple useAuth() subscribers
5. **Fix test strategy** — Test app behavior through hooks and rendered components, not SDK mocks
