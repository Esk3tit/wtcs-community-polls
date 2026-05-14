---
phase: 13
slug: uidn-02-mobile-audit-closure
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-13
verified: 2026-05-13
register_authored_at_plan_time: true
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 13 is a **planning closure phase with zero `src/` edits** (Phase 9 closure invariant honored per D-02). All changes ship under `.planning/closure/` (harness `.mjs` script, screenshot manifest) and the project planning docs (`PROJECT.md`, `REQUIREMENTS.md`, evidence file). No authentication flows, no user-facing surfaces, no API endpoints, no database schema changes, no Edge Function code, no RLS policy edits.

The threat register is built from `<threat_model>` blocks authored at plan time in `13-01-PLAN.md` and `13-02-PLAN.md`. All three threats carry `disposition: accept` with documented mitigation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator shell → harness (Playwright) | The operator runs `audit-screenshots.mjs` to produce binary screenshots; no user-facing service involved. | None — local-only execution; the screenshots are PNG bytes and metadata only. |
| operator shell → Lighthouse CLI | `audit-mobile.sh` runs `npx lighthouse@13.2.0` against `https://polls.wtcsmapban.com` unauthenticated — public production URLs only. | None — Lighthouse fetches HTML/JS as a public visitor; no user data exchanged. |
| executor → planning docs | Text edits to `.planning/` Markdown files (`UIDN-02-mobile-evidence.md`, `PROJECT.md`, `REQUIREMENTS.md`) and `MANIFEST.json`. | Plain text; sha256-pinned manifest entries; no secrets, tokens, or user data. |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-13-01 | Tampering | `audit-screenshots.mjs` harness output (42-PNG corpus) | accept | Planning closure script, not a user-facing service. The sha256 dupe-check (D-05/D-19) hard-fails the harness before MANIFEST write on any unexpected collision; the per-width home↔admin pair is the only whitelisted collision (Phase 9 D-06 evidence — AdminGuard Navigate → LandingPage). The harness output (binary PNGs) is gitignored; only sha256+size+timestamp+kind records are committed via `MANIFEST.json`. No user data at risk. | closed |
| T-13-02 | Tampering | `MANIFEST.json` audit record | accept | The manifest is committed but contains only sha256 + sizeBytes + recordedAt + kind records. The binary PNGs and Lighthouse reports themselves are gitignored. An attacker who modifies the manifest without re-running the harness would produce a manifest inconsistent with the actual artifact bytes, detectable by re-running `audit-screenshots.mjs` (sha256 dupe-check) or `audit-mobile.sh` (which re-writes the lighthouse entries from the actual `.report.{html,json}` files). Low-value target — no PII, no credentials, no behavior-changing data. | closed |
| T-13-03 | Repudiation | Lighthouse score record | accept | Single-run policy (D-13) means scores cannot be re-run for better numbers. The five `.report.json` files (gitignored) are the raw evidence; the numeric values transcribed into `UIDN-02-mobile-evidence.md § v1.2 Rerun` are reproducible by anyone with the JSON via `jq '.categories.performance.score * 100 \| floor'` etc. Score transcription error is a human-error risk caught by the D-22 jq verify gates, not a security threat — the JSON reports are the canonical source of truth and survive in `MANIFEST.json` with sha256 pins. | closed |

*Status: open · **closed***
*Disposition: mitigate (implementation required) · **accept (documented risk)** · transfer (third-party)*

### ASVS coverage (per plan threat models)

| ASVS Section | Applicability | Note |
|--------------|---------------|------|
| V2 Authentication | N/A | No auth flow changes in scope. |
| V3 Session | N/A | No session management changes in scope. |
| V4 Access Control | N/A | No authorization changes in scope. |
| V5 Input Validation | N/A (13-02) / Existing-only (13-01) | Lighthouse CLI validates its own input; `audit-screenshots.mjs` env probes at lines 104 + 114 are unchanged from Phase 9 (anon-key guard + preview-server reachability probe). |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-01 | Closure harness output is sha256-gated against tampering at run time; binary corpus is gitignored. Owner: harness operator (this session). | Khai Phan (operator) | 2026-05-13 |
| AR-13-02 | T-13-02 | MANIFEST committed in detached-record form (sha256 + size + timestamp only); inconsistent manifests are detectable by re-running either harness against the actual binary corpus. | Khai Phan (operator) | 2026-05-13 |
| AR-13-03 | T-13-03 | Lighthouse single-run policy is a workflow contract (D-13), not a security boundary; raw `.report.json` files are the canonical record and round-trip-verifiable via jq (D-22). | Khai Phan (operator) | 2026-05-13 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-13 | 3 | 3 | 0 | Claude Opus 4.7 / `/gsd-secure-phase 13` — Step 3 short-circuit (threats_open: 0 AND register_authored_at_plan_time: true) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-13
