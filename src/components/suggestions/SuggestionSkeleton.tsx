export function SuggestionSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading topics" className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="bg-muted rounded-xl h-24 animate-pulse"
        />
      ))}
    </div>
  )
}
