import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search topics..."
        aria-label="Search topics"
        className="h-10 pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
