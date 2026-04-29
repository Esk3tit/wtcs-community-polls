---
id: SEED-002
status: planted
planted: 2026-04-28
planted_during: v1.1 milestone scoping (post-v1.0)
trigger_when: v1.2 milestone — admin UX + RLS policy work touching poll lifecycle
scope: Medium
source: Tim (community admin) — verbal ask, not previously captured
---

# SEED-002: Admin-controlled per-suggestion results visibility

## The Idea

Admins should be able to control whether voters can see results (with breakouts) for each suggestion. Two control surfaces:

1. **At creation time** — admin sets initial visibility (e.g., `respondents_only` / `public_during` / `public_after_close`) when filling out the suggestion form.
2. **Ad-hoc while live** — admin can flip visibility on a live suggestion to "reveal results to all voters now" without closing the suggestion. One-way reveal is acceptable; toggle-back can be a stretch goal.

Today (v1.0): RSLT-05 hard-codes "respondents only, even after close" via RLS. This seed loosens that into a per-suggestion setting.

## Why This Matters

Different suggestions have different governance dynamics. Some asks (e.g., "should we ban map X?") benefit from vote-then-reveal to prevent bandwagoning. Other asks (e.g., "what's the community sentiment on this proposal?") work better with live transparency so undecided voters can see the trend before committing. Currently admins have no lever to choose; every suggestion behaves the same way.

Tim raised this directly during v1.0 → v1.1 transition. It's a real admin UX gap, not theoretical.

## When to Surface

**Trigger:** v1.2 milestone scoping — the milestone right after v1.1 (Hygiene & Polish) closes.

This seed should be presented during `/gsd-new-milestone` when the milestone scope matches any of these conditions:
- Admin UX expansion (new lifecycle controls on suggestions)
- RLS policy revisions on `vote_counts` or `polls`
- New POLL-* (suggestion-creation) requirements
- Any "voting psychology" or "results transparency" themed work

## Scope Estimate

**Medium** — touches schema, RLS, EF, two UIs, tests.

**Schema additions:**
- `polls.results_visibility` enum: `respondents_only` (default — preserves v1.0 behavior) | `public_during` | `public_after_close`
- Optional: `polls.results_revealed_at timestamptz` for ad-hoc reveal audit
- Migration must default existing rows to `respondents_only` (zero behavior change for in-flight v1.0 suggestions)

**RLS:**
- Rewrite `vote_counts` SELECT policy: current "voter must have cast vote" → conditional on `polls.results_visibility` AND `polls.closed_at`
- Invariant test must guard against regression to "anyone can SELECT vote_counts"

**Edge Function:**
- New admin EF: `reveal-poll-results` — gated on `requireAdmin`, sets `results_visibility = 'public_during'` (or whatever ad-hoc means) + `results_revealed_at = now()`
- Optional: include in existing `update-poll` EF if scope creep is contained

**Admin UI:**
- POLL-NN (new): Visibility selector on creation form (default: respondents_only)
- ADMN-NN (new): "Reveal results now" button on live admin suggestion card with confirmation modal (one-way action, communicates irreversibility)

**User UI:**
- Conditionally render results pre-vote when `results_visibility != respondents_only`
- Update closed-suggestion archive view to honor new policy

**Tests:**
- RLS invariant tests for each visibility combination × pre/post-vote × pre/post-close (matrix ~6 cases)
- Admin EF authorization tests
- UAT: admin creates "public_during" suggestion → non-voter sees results; admin reveals "respondents_only" mid-flight → previously-blocked non-voters see results
- E2E Playwright spec: cover ad-hoc reveal happy path

## Breadcrumbs

- v1.0 RSLT-05: "Results visible only to respondents — even after close" — currently a Key Decision marked ✓ Good. v1.2 reframes this as the **default** behavior, not the only behavior.
- v1.0 PROJECT.md → Out of Scope: "Response attribution" stays out of scope. This seed is about aggregate visibility, NOT individual vote disclosure.
- v1.0 research/PITFALLS.md Pitfall 10: "Results Visibility Logic Leaking Through RLS" — its prevention strategy must be re-validated under the new policy.
- v1.0 phases/02-browsing-responding/ — Phase 2 implementation is the integration point for any UI changes.

## Notes

- **Backwards compat:** All v1.0 suggestions default to `respondents_only`. No data backfill needed.
- **One-way ad-hoc reveal:** Strongly recommended over toggle. Reverting to "respondents only" after a public reveal would surprise voters who already saw results — confusing UX, possible trust hit. Keep simple: reveal is a forward-only action.
- **Pre-vote bandwagon risk:** When `results_visibility = public_during`, voters can see live counts before committing. This is the intended trade-off — admins choose this mode deliberately for transparency-over-integrity asks. Surface this trade-off in the admin creation UI tooltip.
- **No retro reveal of identities:** Even with public results, individual `votes` rows remain hidden. Aggregate-only stays the rule.
- **Sister-site precedent:** WTCS Map Vote/Ban uses real-time tally visibility for the ban draft; this seed lets community polls match that pattern when admins want it.

## v1.2 Working Sketch (not binding)

If v1.2 is "Admin Visibility Controls":
- Phase X: Schema + RLS rewrite + EF + invariant test (foundations, no UI)
- Phase X+1: Admin UI (creation selector + ad-hoc reveal button) + user UI conditional render + UAT
- Phase X+2 (optional): Polish — copy/tooltips, archive view audit, accessibility pass

Single-phase split is also viable if scope holds.
