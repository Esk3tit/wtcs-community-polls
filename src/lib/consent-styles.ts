// Phase 6 UI-REVIEW Fix #3 — shared width token for the consent-card surfaces
// (ConsentBanner + ConsentChip). UI-SPEC §3.1 locks both surfaces to
// `min(20rem, calc(100vw - 2rem))`. Centralizing prevents spec drift.
//
// NOTE: DebugAuthOverlay uses `min(28rem, ...)` and is intentionally NOT
// covered by this token — it is a different surface with a different width.

export const CONSENT_CARD_MAX_W = 'max-w-[min(20rem,calc(100vw-2rem))]' as const
