import { useState, useMemo } from 'react'
import { useSuggestions } from '@/hooks/useSuggestions'
import { useCategories } from '@/hooks/useCategories'
import { useDebounce } from '@/hooks/useDebounce'
import { useVoteCounts } from '@/hooks/useVoteCounts'
import { useVoteSubmit } from '@/hooks/useVoteSubmit'
import { SearchBar } from '@/components/suggestions/SearchBar'
import { CategoryFilter } from '@/components/suggestions/CategoryFilter'
import { EmptyState } from '@/components/suggestions/EmptyState'
import { SuggestionSkeleton } from '@/components/suggestions/SuggestionSkeleton'
import { SuggestionCard } from '@/components/suggestions/SuggestionCard'

export function SuggestionList({ status }: { status: 'active' | 'closed' }) {
  const { suggestions, userVotes, loading, error, addOptimisticVote } = useSuggestions(status)
  const { categories } = useCategories()
  const [searchText, setSearchText] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(searchText, 300)

  const suggestionIds = useMemo(() => new Set(suggestions.map(s => s.id)), [suggestions])
  const votedPollIds = useMemo(
    () => Array.from(userVotes.keys()).filter(id => suggestionIds.has(id)),
    [userVotes, suggestionIds]
  )
  // Polling enabled only for active suggestions. Closed suggestions fetch once on mount.
  const enablePolling = status === 'active'
  const { voteCounts } = useVoteCounts(votedPollIds, enablePolling)
  const { submitVote, submittingPollId, submittingChoiceId } = useVoteSubmit(addOptimisticVote)

  const hasActiveFilters = activeCategoryId !== null || debouncedSearch.length > 0

  const filteredSuggestions = useMemo(() => {
    let result = suggestions

    if (activeCategoryId) {
      result = result.filter((s) => s.category_id === activeCategoryId)
    }

    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase()
      result = result.filter((s) => s.title.toLowerCase().includes(search))
    }

    return result
  }, [suggestions, activeCategoryId, debouncedSearch])

  const clearFilters = () => {
    setSearchText('')
    setActiveCategoryId(null)
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">
          {status === 'active' ? 'Active Topics' : 'Archive'}
        </h1>
        <div className="mt-6">
          <SuggestionSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">
          {status === 'active' ? 'Active Topics' : 'Archive'}
        </h1>
        <div className="mt-6 text-center py-8">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {status === 'active' ? 'Active Topics' : 'Archive'}
      </h1>
      <div className="mt-4 flex flex-col gap-3">
        <SearchBar value={searchText} onChange={setSearchText} />
        <CategoryFilter
          categories={categories}
          activeId={activeCategoryId}
          onSelect={setActiveCategoryId}
        />
      </div>
      <div className="mt-6">
        {filteredSuggestions.length === 0 && hasActiveFilters && (
          <EmptyState variant="no-matches" onClear={clearFilters} />
        )}
        {filteredSuggestions.length === 0 && !hasActiveFilters && (
          <EmptyState
            variant={status === 'active' ? 'no-active' : 'no-archive'}
          />
        )}
        {filteredSuggestions.length > 0 && (
          <div className="space-y-3">
            {filteredSuggestions.map((suggestion) => {
              const categoryIndex = suggestion.categories
                ? categories.findIndex(
                    (c) => c.id === suggestion.categories!.id
                  )
                : 0

              return (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  categoryIndex={categoryIndex >= 0 ? categoryIndex : 0}
                  userChoiceId={userVotes.get(suggestion.id)}
                  onVote={submitVote}
                  voteCounts={voteCounts.get(suggestion.id)}
                  submittingPollId={submittingPollId}
                  submittingChoiceId={submittingChoiceId}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
