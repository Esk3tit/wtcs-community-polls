# DOCS-03 Cross-Check Results

Generated: 2026-05-07
Rule: REQ-ID declared only when ≥2 of 3 sources agree (D-08)
Sources: (1) phase VERIFICATION.md | (2) REQUIREMENTS.md inline | (3) v1.0 milestone audit

## Source Notes

**Source 2 (REQUIREMENTS.md):** The current REQUIREMENTS.md covers v1.1 requirements only (OBSV-*, TEST-07..10, UIDN-02..04, DOCS-01..04). The v1.0 REQ-IDs (AUTH-*, VOTE-*, RSLT-*, CATG-*, POLL-*, LIFE-*, INFR-*, TEST-01..06, ADMN-*, UIDN-01) do not appear inline in REQUIREMENTS.md because that document tracks the v1.1 milestone, not v1.0. Accordingly, Source 2 is "silent" (N/A) for all v1.0 REQ-IDs. Per D-08, 2-of-3 is still achievable with Sources 1 + 3.

## Planned Declarations

| File | Planned requirements-completed | Source 1 (VERIFICATION.md) | Source 2 (REQUIREMENTS.md) | Source 3 (Audit) | Agree count | Decision |
|------|-------------------------------|----------------------------|---------------------------|-----------------|-------------|----------|
| 01-04-SUMMARY.md | [AUTH-04, AUTH-05, TEST-02] | AUTH-04 ✓ (01-VERIFICATION Requirements Coverage "01-03, 01-04"), AUTH-05 ✓ (same row), TEST-02 ✓ ("01-04") | N/A (v1.0 IDs not in v1.1 REQUIREMENTS.md) | ✓ audit tech_debt phase_01: "01-04-SUMMARY missing… AUTH-04, AUTH-05, TEST-02"; requirements_integration_map confirms all three | 2 | DECLARE |
| 02-01-SUMMARY.md | [CATG-02, CATG-03, CATG-04] | CATG-02 ✓ ("02-01"), CATG-03 ✓ ("02-01"), CATG-04 ✓ ("02-01") | N/A | ✓ audit tech_debt phase_02: "02-01..02-04 SUMMARY files all lack requirements-completed frontmatter (VOTE-*, RSLT-*, CATG-* covered per VERIFICATION)"; requirements_integration_map confirms CATG-02/03/04 | 2 | DECLARE |
| 02-02-SUMMARY.md | [VOTE-01, VOTE-02, VOTE-03, RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05, INFR-04] | VOTE-01 ✓ ("02-02"), VOTE-02 ✓, VOTE-03 ✓, RSLT-01 ✓, RSLT-02 ✓, RSLT-03 ✓, RSLT-04 ✓, RSLT-05 ✓, INFR-04 ✓ | N/A | ✓ audit tech_debt phase_02: group mention; requirements_integration_map confirms each ID | 2 | DECLARE |
| 02-03-SUMMARY.md | [TEST-03] | TEST-03 ✓ ("02-03") | N/A | ✓ audit requirements_integration_map: TEST-03 SELF-CONTAINED (Phase 2); audit tech_debt phase_02 group mention | 2 | DECLARE |
| 02-04-SUMMARY.md | [] | No REQ-ID attributed solely to 02-04 in VERIFICATION (CATG-02 → 02-01; RSLT-05 → 02-02; 02-04 is a regression-fix restore) | N/A | No REQ-ID attributed to 02-04 in audit requirements_integration_map; audit tech_debt group mention covers 02-01..04 as a block but 02-04 provides only "topics-page-wiring, archive-page-wiring" (gap closure, not original implementation) | 0 | EMPTY ARRAY — gap-closure plan; no v1.0 REQ-ID uniquely maps here per ≥2 sources |
| 03-02-SUMMARY.md | [VOTE-04] | VOTE-04 ✓ (03-VERIFICATION Requirements Coverage "03-02") | N/A | ✓ audit tech_debt phase_03: "03-02-SUMMARY missing requirements-completed (VOTE-04 covered per REQUIREMENTS.md inline evidence but not declared)"; requirements_integration_map VOTE-04 WIRED | 2 | DECLARE |
| 04-02-SUMMARY.md | [ADMN-04, ADMN-02, ADMN-03, CATG-01, POLL-02, LIFE-01, TEST-05] | ADMN-04 ✓ ("04-02"), ADMN-02 ✓ ("04-02, 04-03"), ADMN-03 ✓ ("04-02, 04-03"), CATG-01 ✓ ("04-02, 04-03"), POLL-02 ✓ ("04-01, 04-02, 04-04"), LIFE-01 ✓ ("04-01, 04-02"), TEST-05 ✓ ("All 4 plans") | N/A | ✓ audit tech_debt phase_04: "04-02-SUMMARY missing requirements-completed for POLL-02 / POLL-03 / POLL-04 / VOTE-*"; requirements_integration_map confirms each ID | 2 | DECLARE listed IDs (see discrepancy for VOTE-* below) |
| 04-04-SUMMARY.md | [POLL-01, POLL-02, POLL-03, POLL-04, POLL-05, POLL-06, POLL-07, LIFE-01, LIFE-02, LIFE-03, TEST-05] | POLL-01 ✓ ("04-02, 04-04"), POLL-02 ✓ ("04-01, 04-02, 04-04"), POLL-03 ✓ ("04-04"), POLL-04 ✓ ("04-04"), POLL-05 ✓ ("04-02, 04-04"), POLL-06 ✓ ("04-02, 04-04"), POLL-07 ✓ ("04-02, 04-04"), LIFE-01 ✓ (04-04 switches useSuggestions to polls_effective), LIFE-02 ✓ ("04-02, 04-04"), LIFE-03 ✓ ("04-04"), TEST-05 ✓ ("All 4 plans") | N/A | ✓ audit tech_debt phase_04: "04-04-SUMMARY missing requirements-completed for POLL-02 / POLL-03 / POLL-04 / VOTE-*"; requirements_integration_map confirms each ID | 2 | DECLARE listed IDs (see discrepancy for VOTE-* below) |
| 04-05-SUMMARY.md | [] | 04-VERIFICATION does not list 04-05 (plan written after verification artifact); no REQ-ID attributed to admin nav link | N/A | Audit predates 04-05; requirements_integration_map has no entry for admin nav link; no REQ-ID maps to pure-UI nav discoverability | 0 | EMPTY ARRAY — gap-closure plan (UAT gap); no v1.0 REQ-ID maps here per ≥2 sources |

## Discrepancies (Single-Source Candidates)

| File | REQ-ID | Only Source | Recommendation | User decision |
|------|--------|-------------|----------------|---------------|
| 04-02-SUMMARY.md | VOTE-* (VOTE-01, VOTE-02, VOTE-03, VOTE-04) | Source 3 only — audit tech_debt phase_04 text "POLL-02 / POLL-03 / POLL-04 / VOTE-*" is the sole reference; 04-VERIFICATION.md Requirements Coverage contains no VOTE-* rows for Phase 4 (VOTE-01..04 are Phase 2/3 requirements per 02-VERIFICATION and 03-VERIFICATION); requirements_integration_map maps all VOTE-* to Phase 2/3 | EXCLUDE — VOTE-01..04 are Phase 2/3 requirements (verified in 02-VERIFICATION + 03-VERIFICATION). The "VOTE-*" text in the Phase 04 audit tech_debt entry appears to be a copyediting artifact; 04-VERIFICATION.md has no VOTE-* rows, and 04-02's own provides field lists only admin EFs. Including VOTE-* in 04-02-SUMMARY would be incorrect attribution. | |
| 04-04-SUMMARY.md | VOTE-* (VOTE-01, VOTE-02, VOTE-03, VOTE-04) | Source 3 only — same audit tech_debt phrase as above; 04-VERIFICATION.md Requirements Coverage contains no VOTE-* rows for Phase 4 | EXCLUDE — same rationale as above for 04-02. VOTE-01..04 belong to Phase 2/3 SUMMARYs (already declared in 02-02 and 03-02). Declaring them in 04-04 would be duplicate/incorrect attribution. | |

## Resolution

Resolved-by: <fill-in-handle> on <YYYY-MM-DD>
