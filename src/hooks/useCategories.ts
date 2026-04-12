import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/lib/types/suggestions'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (fetchError) {
      console.error('Failed to fetch categories:', fetchError)
      setError('Failed to load categories.')
      setCategories([])
      setLoading(false)
      return
    }
    setCategories(data ?? [])
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // Defer the fetch so the effect body itself doesn't call setState
    // synchronously (satisfies react-hooks/set-state-in-effect).
    const t = setTimeout(() => {
      void fetchCategories()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchCategories])

  return { categories, loading, error, refetch: fetchCategories }
}
