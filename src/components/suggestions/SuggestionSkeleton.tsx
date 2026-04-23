/**
 * UI-SPEC Contract 1 — skeleton silhouette mirrors SuggestionCard.
 *
 * Outer wrapper: aria-busy + aria-label + space-y-3 gap (matches the
 * 3-row suggestion list spacing). Each shell uses the same card classes
 * as SuggestionCard's outer div (`bg-card rounded-xl border shadow-sm
 * p-5`) so the transition from loading to loaded is shape-stable (no CLS).
 * `shadow-sm` is part of the card's base silhouette — omitting it caused
 * a subtle but visible shadow-pop when real cards mounted (gemini-code-
 * assist PR #4 review, 2026-04-22).
 *
 * 3 rows per card mirror the real card:
 *   Row 1: category badge + time meta
 *   Row 2: title  (h-7 = 28px to match text-lg line-height; h-5 was 8px
 *                  short of the real title row, producing a small vertical
 *                  shift on hydrate)
 *   Row 3: avatar + creator label + response count
 *
 * `isArchive` toggles the aria-label between "Loading topics" (default)
 * and "Loading archive" — required by UI-SPEC §Contract 1 accessibility
 * section so /topics and /archive route announcers read correctly.
 */
export function SuggestionSkeleton({ isArchive = false }: { isArchive?: boolean }) {
  return (
    <div
      aria-busy="true"
      aria-label={isArchive ? 'Loading archive' : 'Loading topics'}
      className="space-y-3"
    >
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="bg-card rounded-xl border shadow-sm p-5">
          {/* Row 1: category badge + time meta */}
          <div className="flex items-center justify-between gap-2">
            <div className="bg-muted rounded h-4 w-20 animate-pulse" />
            <div className="bg-muted rounded h-4 w-16 animate-pulse" />
          </div>
          {/* Row 2: title */}
          <div className="bg-muted rounded h-7 w-3/4 mt-2 animate-pulse" />
          {/* Row 3: avatar + creator meta + responses */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-muted rounded-full h-6 w-6 animate-pulse" />
              <div className="bg-muted rounded h-4 w-24 animate-pulse" />
            </div>
            <div className="bg-muted rounded h-4 w-16 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
