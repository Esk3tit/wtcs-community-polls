---
phase: 1
reviewers: [codex]
reviewed_at: "2026-04-06T22:00:00.000Z"
review_rounds: 2
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 1

## Codex Review (Round 2 — Post-Revision)

**Model:** GPT-5.4 via Codex CLI 0.118.0
**Round:** 2 (reviewing plans revised from Round 1 feedback)

### Prior Concern Resolution

| Prior Concern | Status | Assessment |
|---|---|---|
| 1. 2FA enforcement fails open | **RESOLVED** | The revised callback explicitly signs out and redirects on all three failure cases: missing `provider_token`, Discord API failure, and falsey `mfa_enabled`. The only success path is after confirmed `mfa_enabled === true`. |
| 2. Provider token availability unresolved | **NOT RESOLVED** | The plan still depends on `session.provider_token` being available via `supabase.auth.getSession()` in the callback, even though the research marks that as an open question. The fallback is "fail closed and maybe switch to implicit later," which is not an implementation resolution. |
| 3. Admin seeding conflicts with FK constraint | **RESOLVED** | Moving from pre-inserted `profiles` rows to an `admin_discord_ids` config table removes the FK problem cleanly. This is the right structural fix. |
| 4. Tests validate mocks, not app behavior | **PARTIALLY RESOLVED** | Most tests are better: `AuthProvider`, guards, landing page, theme, and error page are rendered behaviorally. But the callback test still reimplements callback logic in the test instead of exercising the real route component. |
| 5. `routeTree.gen.ts` build-path issue | **RESOLVED** | Adding generation before `tsc -b` addresses the clean-checkout build failure. |
| 6. Cross-plan write policy inconsistency | **RESOLVED** | Narrow self-update RLS policy with column-guard trigger is a reasonable compromise. |
| 7. useAuth() subscription duplication | **RESOLVED** | AuthProvider context with single `onAuthStateChange` subscription. |
| 8. vote_counts rows not pre-created | **RESOLVED** | Upsert trigger handles missing rows. |

**Score: 6/8 RESOLVED, 1 PARTIALLY RESOLVED, 1 NOT RESOLVED**

---

### Summary

The revision is materially better than round 1. The route build issue, admin seed FK flaw, auth subscription duplication, and vote count trigger problem are all addressed in a credible way. The remaining problem is that the hardest part of the phase is still unresolved: the auth design still assumes provider-token availability in a place the research itself does not prove, so the revised plan may now fail closed for every user rather than fail open for some. The test strategy is improved overall, but still does not fully validate the real callback route behavior.

---

### Strengths

- The 2FA logic is now clearly fail-closed instead of permissive.
- The admin seeding redesign is structurally correct and much safer than pre-inserting `profiles`.
- Cross-plan ownership is cleaner: schema/RLS in Plan 02, consumers in Plan 03.
- The `AuthProvider` refactor is the right fix for duplicated auth subscriptions.
- The `vote_counts` upsert closes the missing-row gap cleanly.
- The clean-checkout build path is substantially stronger with explicit route generation before typechecking.
- Test coverage is more behavioral than before across most auth/UI surfaces.

---

### New Concerns

- **HIGH**: The callback still gets `provider_token` from `supabase.auth.getSession()`, even though the research says token availability there is uncertain and may only exist on the initial auth event. This can turn the whole login flow into "reject everyone."
- **HIGH**: The new narrow profile self-update policy still allows browser writes to `mfa_verified`. That is a security flag and should not be client-writable. A client-writable 2FA-verification marker is a bad boundary even if the current callback sets it correctly.
- **HIGH**: `handle_new_user()` still assumes `NEW.raw_user_meta_data->>'provider_id'` for Discord ID. The revision hardened username extraction, but not the critical Discord ID extraction. If that key is wrong, admin derivation and profile creation break.
- **MEDIUM**: The plan text claims an added secondary `ON CONFLICT (discord_id)` path in `handle_new_user()`, but the shown SQL only has `ON CONFLICT (id)`. That mismatch suggests the fix was described more strongly than it was specified.
- **MEDIUM**: The callback success path does not check the result of the `profiles.update(...)`. A user can be let through even if profile sync or `mfa_verified` persistence fails.
- **MEDIUM**: `callback-behavior.test.tsx` still does not exercise the real `src/routes/auth/callback.tsx`. It tests duplicated logic in the test file, so route-level regressions can slip through.

---

### Remaining Concerns

- **HIGH**: Provider token availability is still unresolved in practice, not just in documentation.
- **MEDIUM**: Tests still do not prove actual callback route behavior end-to-end.
- **MEDIUM**: Metadata-shape assumptions remain for the most important field: Discord ID.

---

### Risk Assessment

**HIGH**

The revisions fixed several concrete design flaws, but the phase still hinges on one unresolved execution risk: whether the callback can actually obtain the Discord provider token in the chosen Supabase flow. If not, Phase 1 fails its core success criterion even though it now fails safely. On top of that, the new client-writable `mfa_verified` flag is a security design regression, and the callback tests still do not validate the real route implementation.

---

## Consensus Summary

*Single reviewer (Codex/GPT-5.4) across 2 rounds.*

### Progress from Round 1

6 of 8 original HIGH concerns fully resolved. Significant improvement in plan quality, especially:
- Admin seeding (structural fix)
- Build path (clean-checkout safe)
- Auth subscriptions (AuthProvider context)
- Vote count triggers (upsert)
- 2FA fail-closed logic

### Remaining Blockers

1. **Provider token availability** (HIGH, carried from R1) — The entire auth flow depends on `session.provider_token` being available, which research marks as uncertain. This is a runtime unknown that may need a spike/proof before execution.
2. **Client-writable `mfa_verified`** (HIGH, new in R2) — Security flag should not be browser-writable. Consider server-side RPC or removing the column from the self-update policy.
3. **Discord ID metadata key** (HIGH, new in R2) — `raw_user_meta_data->>'provider_id'` assumption is critical for admin derivation. Needs runtime verification.

### Actionable Recommendations

1. **Spike the provider token** — Before executing Plan 03, run a minimal test to confirm `provider_token` availability in Supabase PKCE flow. If unavailable, switch to implicit flow.
2. **Move `mfa_verified` writes server-side** — Use a Supabase RPC function or narrow the RLS policy to exclude `mfa_verified` from client-writable columns.
3. **Verify Discord metadata shape** — Check actual `raw_user_meta_data` keys from a real Supabase Discord login before executing Plan 02.
4. **Test the real callback route** — Have `callback-behavior.test.tsx` import and render the actual route component.

### Divergent Views
*N/A — single reviewer.*
