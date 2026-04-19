import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { deferSetState } from '@/lib/deferSetState'
import { useDebounce } from './useDebounce'

export type AdminTarget = {
  id: string
  discord_id: string
  discord_username: string
  avatar_url: string | null
}

export function useSearchAdminTargets() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminTarget[]>([])
  const [searching, setSearching] = useState(false)
  const normalizedQuery = query.trim()
  const canSearch = normalizedQuery.length >= 2
  const debounced = useDebounce(query, 300)

  useEffect(() => {
    // All setState calls below run inside deferred / async callbacks so the
    // effect body itself never calls setState synchronously (required by
    // react-hooks/set-state-in-effect).
    const normalized = debounced.trim()
    if (normalized.length < 2) {
      const handle = deferSetState(() => {
        setResults([])
        setSearching(false)
      })
      return handle.cancel
    }

    const handle = deferSetState(() => {
      setSearching(true)
      void supabase.functions
        .invoke<{ results: AdminTarget[] }>('search-admin-targets', {
          body: { query: normalized },
        })
        .then(({ data, error }) => {
          if (handle.isCancelled()) return
          if (error || !data) {
            setResults([])
            return
          }
          setResults(data.results ?? [])
        })
        .catch(() => {
          if (handle.isCancelled()) return
          setResults([])
        })
        .finally(() => {
          if (!handle.isCancelled()) setSearching(false)
        })
    })
    return handle.cancel
  }, [debounced])

  return { query, normalizedQuery, canSearch, setQuery, results, searching }
}
