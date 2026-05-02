// Shared width token for the consent-card surfaces (ConsentBanner +
// ConsentChip). Both are locked to `min(20rem, calc(100vw - 2rem))`;
// centralizing prevents drift between them. DebugAuthOverlay uses a
// different width and is intentionally NOT covered by this token.

export const CONSENT_CARD_MAX_W = 'max-w-[min(20rem,calc(100vw-2rem))]' as const
