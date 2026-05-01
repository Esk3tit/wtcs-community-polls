---
phase: 07-observability-hardening
status: passed
threats_total: 13
threats_closed: 13
threats_open: 0
asvs_level: default
audited_at: 2026-04-30T00:00:00Z
audit_trail:
  - 07-01-PLAN.md threat_model (T-07-01..T-07-04)
  - 07-02-PLAN.md threat_model (T-07-05..T-07-09)
  - 07-03-PLAN.md threat_model (T-07-10..T-07-13)
  - 07-VERIFICATION.md (D-08 evidence + Sentry permalink for T-07-13)
  - 07-UAT.md (runtime evidence for T-07-03 mitigation chain — tests 5, 6, 8)
---

# Phase 07 — Security Audit (Observability Hardening)

Verified each declared threat disposition against the implemented code (`src/main.tsx`, `src/routes/[__smoke].tsx`, `src/components/debug/RenderThrowSmoke.tsx`, `vite.config.ts`, `netlify.toml`) and the closure documents (`07-VERIFICATION.md`, `07-UAT.md`). Implementation files were not modified; this audit records evidence only.

## Threat Verification

| Threat ID | Cat | Disposition | Status | Evidence |
|-----------|-----|-------------|--------|----------|
| T-07-01 | I | accept | CLOSED | Listed below in Accepted Risks. Rationale (CONTEXT `<security_threat_model>`): keepNames exposes OSS-equivalent identifiers (`RootLayout`, `RenderThrowSmoke`, `handleResponseSubmit`); React + TanStack Router are public OSS, component names reveal nothing material. Observability gain (legible Sentry frames) > minor reverse-engineering convenience. Implementation evidence — `vite.config.ts:46` `keepNames: true`; OBSV-02 bundle-delta documents the +6.24% gzip cost. |
| T-07-02 | T | accept | CLOSED | Listed below in Accepted Risks. Rationale: forged Sentry events are an inherent property of any browser-side SDK; Sentry's free-tier rate limits are the sole defence; this surface was already accepted at Phase 5 ship and Phase 7 introduces no new tampering primitive. |
| T-07-03 | D | mitigate | CLOSED | `src/main.tsx:61` registers `Sentry.dedupeIntegration()` explicitly (WR-02 — pinned for audit so a future SDK upgrade cannot silently drop it). `src/main.tsx:115-136` `taggedHandler` factory wraps all three React 19 root hooks (`onUncaughtError`/`onCaughtError`/`onRecoverableError`) and calls `scope.setTag('boundary', 'app-root')` BEFORE delegating to `Sentry.reactErrorHandler()` (line 118). `Sentry.ErrorBoundary` `beforeCapture` (line 159) sets the same tag on the SDK auto-capture event. Result: every event in any deduped pair carries `tags.boundary='app-root'`, so Sentry.Dedupe can never drop the tag. Greps: `dedupeIntegration` count = 2 (import + call), `scope.setTag('boundary', 'app-root')` count = 2, `taggedHandler` count = 4. UAT test 5 captured the live envelope from `/__smoke?render=1` showing `sdk.integrations` includes "Dedupe", `tags.boundary='app-root'`, `mechanism.type='auto.function.react.error_handler'`, and a 2-exception → 1-event collapse via cause linkage — direct runtime confirmation of the dedupe-resilient mitigation chain. |
| T-07-04 | I | accept | CLOSED | Listed below in Accepted Risks. Rationale: `VITE_*`-prefixed vars are designed by Vite to be inlined into the browser bundle; `VITE_NETLIFY_CONTEXT` value (`'production'` / `'deploy-preview'` / etc.) is environmental metadata, not a secret. `netlify.toml:17` shell-substitutes `$CONTEXT` at build time; Round-2 HIGH-1 fix surfaces it on Sentry events' `environment` field, which is itself public deploy context. |
| T-07-05 | I | mitigate | CLOSED | `src/routes/[__smoke].tsx:50-54` `beforeLoad` hook contains `if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') { throw notFound() }`. On production builds this returns the standard TanStack 404 (root layout has no custom `notFoundComponent`, so the route appears not to exist — zero-info response). UAT test 8 confirms: production-context navigation to `/__smoke` rendered "Not Found" inside RootLayout shell with no Sentry event fired and no `RenderThrowSmoke` chunk fetched. Greps: `VITE_NETLIFY_CONTEXT === 'production'` count = 1, `throw notFound()` count = 1, `beforeLoad` count = 2 (comment + invocation). |
| T-07-06 | D | mitigate | CLOSED | Same `beforeLoad` env-gate as T-07-05. Critical structural property: the `lazy(() => import('@/components/debug/RenderThrowSmoke'))` call sits inside the route's `component` body (`src/routes/[__smoke].tsx:18-22`), not at module top level — so `notFound()` thrown in `beforeLoad` short-circuits BEFORE the lazy chunk is ever requested. Throw component is never instantiated on prod, no Sentry event fires, no quota burn possible from drive-by traffic. UAT test 8 evidence: production-context build's DevTools Network tab confirms the `RenderThrowSmoke` lazy chunk is never fetched on prod navigation to `/__smoke?render=1`. Greps: `lazy(` count = 1 (inside component scope per file structure). |
| T-07-07 | I | accept | CLOSED | Listed below in Accepted Risks (duplicate of T-07-04). |
| T-07-08 | E | accept | CLOSED | Listed below in Accepted Risks. Rationale: prod data access is gated by Discord OAuth + Supabase RLS at the data layer, not by the smoke route. The smoke route renders only a thrown error component — it touches no data. A deploy preview pointing at production data is out of scope for Phase 7's observability surface. |
| T-07-09 | T | accept | CLOSED | Listed below in Accepted Risks (duplicate of T-07-01). The lazy smoke chunk on a deploy preview is publicly downloadable, but `RenderThrowSmoke` is a debug component containing only `throw new Error('...')` — reverse-engineering it teaches an attacker nothing. |
| T-07-10 | I | accept | CLOSED | Listed below in Accepted Risks. Rationale: the Sentry permalink committed in `07-VERIFICATION.md` (`https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/`) requires Sentry org auth to view; the deterministic smoke message string is benign and present in the source repo regardless. Scrapers gain nothing exploitable. |
| T-07-11 | I | accept | CLOSED | Listed below in Accepted Risks. Rationale: per-chunk byte sizes in `.planning/closure/OBSV-02-bundle-delta.md` are observable by anyone who fetches the deployed `dist/`; same trust level as the deployed bundle itself. No new disclosure. |
| T-07-12 | S | accept | CLOSED | Listed below in Accepted Risks. Rationale: D-09 explicit decision — OBSV-01/02 are config + wiring, not security/auth gates; the Sentry event is independently re-openable via the permalink (T-07-10), so any reviewer can verify the captured evidence without trusting the verifier. Solo sign-off acceptable here; second-human session pool stays reserved for Phase 03 UAT carry-forward. |
| T-07-13 | T | mitigate | CLOSED | `07-VERIFICATION.md` pins all four independently re-verifiable proofs of the captured evidence: (1) Sentry permalink `https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/` (2 occurrences in doc — Required Artifacts row + Verifier footer), (2) Release SHA `72481f065dbaa08edd4c74a51953765923b31262` (re-verified at `b9afb999...`), (3) Event timestamp `2026-04-30T09:20:52.792Z`, (4) Environment tag `deploy-preview` (Round-2 HIGH-1 verified). Anyone can open the permalink and confirm the documented mechanism.type, componentStack, frame names, exception value, and environment match what the doc claims; a future maintainer cannot fake a passing status without producing a matching live event. Re-verification path is single-click on any future deploy preview via `/__smoke?render=1`. |

## Accepted Risks Log

The following dispositions are documented `accept` in the threat register and confirmed sound by audit. No mitigation code is required; rationale below justifies each.

### T-07-01 — `keepNames: true` exposes original function/component names in shipped JS
- **Category:** I (Information disclosure)
- **Rationale:** OSS-equivalent stack (React + TanStack Router are public). Component names like `RootLayout`, `RenderThrowSmoke`, `handleResponseSubmit` reveal nothing material that the OSS framework code does not already make visible. Observability gain — legible Sentry stack frames during launch-time triage — outweighs the minor reverse-engineering convenience. Documented in CONTEXT `<security_threat_model>`.
- **Trade-off:** +6.24% gzip bundle delta accepted under D-14 ship-anyway policy (see `.planning/closure/OBSV-02-bundle-delta.md`).

### T-07-02 — Forged Sentry events from browser
- **Category:** T (Tampering)
- **Rationale:** Inherent property of any client-side SDK. Sentry's free-tier rate-limits per project are the only defence and are sufficient. No auth gate is added or expected at v1.1. Pre-existing accepted risk from Phase 5 ship; Phase 7 introduces no new tampering primitive.

### T-07-04 — `VITE_NETLIFY_CONTEXT` inlined into shipped JS
- **Category:** I (Information disclosure)
- **Rationale:** Vite's `VITE_*`-prefixed env vars are explicitly designed to be public — RESEARCH `<integration_points>` calls this out. The string is environmental metadata (`'production'` / `'deploy-preview'`), not a secret. Anyone can already infer environment by curling `https://polls.wtcsmapban.com`. The Round-2 HIGH-1 surfacing of this value on the Sentry `environment` field is also public.

### T-07-07 — `VITE_NETLIFY_CONTEXT` inlined (Plan 02 duplicate)
- **Category:** I (Information disclosure)
- **Rationale:** Duplicate of T-07-04. Same disposition; no separate mitigation required.

### T-07-08 — Env-gate bypass via deploy preview pointing at prod data
- **Category:** E (Elevation of privilege)
- **Rationale:** Out of scope for Phase 7. Production data access is gated by Discord OAuth + Supabase RLS at the data layer, NOT by the smoke route. The smoke route renders only a thrown error component — it touches no Supabase, no auth state, no user data. A non-prod deploy preview pointing at prod data would still be subject to RLS.

### T-07-09 — Smoke chunk reverse-engineerable on deploy preview
- **Category:** T (Tampering)
- **Rationale:** Identical reasoning to T-07-01. The lazy `RenderThrowSmoke` chunk on a deploy preview is publicly downloadable, but the component contains only `throw new Error('RenderThrowSmoke: deliberate render-phase throw for Sentry verification')`. Reverse-engineering it teaches an attacker nothing.

### T-07-10 — Sentry permalink probed by scrapers
- **Category:** I (Information disclosure)
- **Rationale:** The committed permalink `https://khai-phan.sentry.io/issues/7451487881/events/5100cc65e9b94bc5b5906ab11ab79d3b/` is auth-gated by Sentry org login. The deterministic smoke message string `RenderThrowSmoke: deliberate render-phase throw for Sentry verification` lives in source code regardless and is benign. No exploitable secret is exposed.

### T-07-11 — Bundle-size table reveals chunk sizes
- **Category:** I (Information disclosure)
- **Rationale:** `.planning/closure/OBSV-02-bundle-delta.md` exposes per-chunk gzip byte sizes that are already observable by anyone who fetches the deployed `dist/` over HTTPS. Same trust level as the live bundle.

### T-07-12 — Solo sign-off (D-09)
- **Category:** S (Spoofing)
- **Rationale:** D-09 explicit decision: OBSV-01/02 are configuration + wiring, not security/auth gates. The Sentry event itself is independently re-openable via the pinned permalink (cross-references T-07-10 and T-07-13), so any reviewer can verify the evidence without trusting the verifier. Second-human session pool reserved for Phase 03 UAT 2+3 carry-forward in Phase 8.

## Unregistered Flags

`07-01-SUMMARY.md ## Threat Flags` — None declared. Stated rationale: "Phase 7's threat register (T-07-01 through T-07-04) covers the surface introduced. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries." Confirmed.

`07-02-SUMMARY.md ## Threat Flags` — None declared. Stated rationale: T-07-05 mitigated (env-gate verified by Task 3 / UAT test 8); T-07-06 mitigated (lazy chunk never resolves on prod, verified by DevTools Network assertion); T-07-07/08/09 accepted per CONTEXT. Confirmed.

`07-03-SUMMARY.md ## Threat Flags` — None declared. Stated rationale: "Phase 7 closure work is config + verification + documentation — no business-logic surface introduced. The two Round-4 in-plan changes (validateSearch String coerce + plan amendments) preserve the env-gate semantics (production still returns TanStack 404) and do not affect the threat register (T-07-05 through T-07-09 unchanged)." The Round-4 `validateSearch` hotfix tightens — not loosens — the gate behaviour and was independently re-verified end-to-end on deploy preview `b9afb99`. No new attack surface.

## Audit Notes

- **All 4 `mitigate` threats verified by direct grep against implementation files**, not against documentation alone:
  - T-07-03: `src/main.tsx` lines 61 (dedupeIntegration), 115-136 (taggedHandler factory), 159 (beforeCapture). Cross-referenced with UAT test 5 live runtime envelope showing the full mitigation chain (Dedupe registered + boundary tag on hook event + 2-exception → 1-event collapse).
  - T-07-05 + T-07-06: `src/routes/[__smoke].tsx` lines 50-54 (beforeLoad env-gate); structural property that `lazy()` call lives inside the route component (not at module top level) confirmed by reading the file. Cross-referenced with UAT test 8 production-context Network-tab evidence.
  - T-07-13: `07-VERIFICATION.md` carries the four required pins (permalink ×2, release SHA, event timestamp, environment tag). All independently re-verifiable.

- **All 9 `accept` threats verified to have sound rationale**, documented in the Accepted Risks Log above. Each rationale was cross-checked against CONTEXT `<security_threat_model>` and the Round-2/Round-3/Round-4 review records — no logic errors found, no re-litigation of accepted risks performed.

- **No implementation security gaps found.** No threats opened. No file modifications required.

- **Round-4 amendments** (validateSearch hotfix + Rolldown keepNames doc correction) reviewed for security impact: the `validateSearch` change tightens the gate (rejects looser coercions like `[1]` and `{toString: () => '1'}` that the intermediate `String()` form would have accepted), which strengthens — not weakens — the env-gate invariant. The keepNames doc correction is purely an assertion-semantics fix; the symbolication mechanism (Rolldown preserving literal `function Name(...)` declarations) is the same shipping behaviour the threat model accepted under T-07-01.

- **Disposition: PASSED.** All 13 threats resolve to CLOSED; no BLOCKERs; no unregistered flags.
