import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
  const debounced = useDebounce(query, 300)

  useEffect(() => {
    // All setState calls below run inside microtask/async callbacks so the
    // effect body itself never calls setState synchronously (required by
    // react-hooks/set-state-in-effect).
    let cancelled = false

    const normalized = debounced.trim()
    if (normalized.length < 2) {
      const t = setTimeout(() => {
        if (cancelled) return
        setResults([])
        setSearching(false)
      }, 0)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
    }

    const startTimer = setTimeout(() => {
      if (cancelled) return
      setSearching(true)
      void supabase.functions
        .invoke<{ results: AdminTarget[] }>('search-admin-targets', {
          body: { query: normalized },
        })
        .then(({ data, error }) => {
          if (cancelled) return
          if (error || !data) {
            setResults([])
            return
          }
          setResults(data.results ?? [])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
    }
  }, [debounced])

  return { query, setQuery, results, searching }
}
