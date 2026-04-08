import { Button } from '@/components/ui/button'
import type { Category } from '@/lib/types/suggestions'

export function CategoryFilter({
  categories,
  activeId,
  onSelect,
}: {
  categories: Category[]
  activeId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      <Button
        role="tab"
        aria-selected={activeId === null}
        variant={activeId === null ? 'default' : 'outline'}
        className={`h-8 px-3 rounded-full text-xs font-medium uppercase tracking-wide ${activeId !== null ? 'bg-card shadow-sm dark:shadow-none' : ''}`}
        onClick={() => onSelect(null)}
      >
        All
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          role="tab"
          aria-selected={activeId === category.id}
          variant={activeId === category.id ? 'default' : 'outline'}
          className={`h-8 px-3 rounded-full text-xs font-medium uppercase tracking-wide ${
            activeId !== category.id ? 'text-muted-foreground bg-card shadow-sm dark:shadow-none' : ''
          }`}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  )
}
