---
id: SEED-001
status: dormant
planted: 2026-04-06
planted_during: Phase 2 (Browsing & Responding)
trigger_when: Phase 5 Launch Hardening
scope: Medium
---

# SEED-001: Add Sentry error logging and PostHog analytics with session replays

## Why This Matters

Without error tracking and analytics, production bugs go unnoticed until users complain, and there's no visibility into how the WTCS community actually uses the platform. This seed covers both sides:

- **Observability (Sentry):** Catch runtime errors, unhandled promise rejections, and Edge Function failures before users report them. Critical for a community tool where trust in platform reliability matters.
- **Insights (PostHog):** Understand usage patterns — which suggestions get the most engagement, how users navigate the platform, where they drop off. Session replays help debug UX issues that error logs can't capture.

## When to Surface

**Trigger:** Phase 5: Launch Hardening — when preparing for production deployment at polls.wtcsmapban.com

This seed should be presented during `/gsd-new-milestone` when the milestone scope matches any of these conditions:
- Production deployment or launch hardening
- Observability, monitoring, or error tracking
- Analytics, usage data, or session replays
- Post-launch operational readiness

## Scope Estimate

**Medium** — A phase or two of work. Sentry and PostHog both have React SDKs that are relatively straightforward to integrate, but proper setup includes: error boundaries, Edge Function instrumentation, custom event tracking for key flows (vote submission, auth), and session replay configuration. Budget constraints ($0/month) mean using free tiers of both services.

## Breadcrumbs

Related code and decisions found in the current codebase:

- `.planning/REQUIREMENTS.md` — May reference monitoring/observability requirements
- `.planning/PROJECT.md` — Project constraints including $0/month budget (Sentry and PostHog both have free tiers)
- `.planning/ROADMAP.md` — Phase 5 (Launch Hardening) is the natural home for this work
- `src/main.tsx` — React entry point where Sentry.init() and PostHogProvider would be added
- `supabase/functions/` — Edge Functions that would need Sentry instrumentation

## Notes

- Both Sentry and PostHog offer generous free tiers suitable for this project's scale
- Sentry: 5K errors/month free, PostHog: 1M events/month free + 5K session recordings
- Consider adding `@sentry/react` error boundary wrapper around the app
- PostHog feature flags could be useful for gradual rollouts in future milestones
