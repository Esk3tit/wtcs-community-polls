/**
 * UI-SPEC Contract 1 — skeleton silhouette mirrors SuggestionCard.
 *
 * Outer wrapper: aria-busy + aria-label + space-y-3 gap (matches the
 * 3-row suggestion list spacing). Each shell uses the same card classes
 * as SuggestionCard's outer div (`bg-card rounded-xl border p-5`) so
 * the transition from loading to loaded is shape-stable (no CLS).
 *
 * 3 rows per card mirror the real card:
 *   Row 1: category badge + time meta
 *   Row 2: title
 *   Row 3: avatar + creator label + response count
 */
export function SuggestionSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading topics" className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="bg-card rounded-xl border p-5">
          {/* Row 1: category badge + time meta */}
          <div className="flex items-center justify-between gap-2">
            <div className="bg-muted rounded h-4 w-20 animate-pulse" />
            <div className="bg-muted rounded h-4 w-16 animate-pulse" />
          </div>
          {/* Row 2: title */}
          <div className="bg-muted rounded h-5 w-3/4 mt-2 animate-pulse" />
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
