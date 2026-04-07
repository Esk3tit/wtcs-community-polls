import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/lib/types/suggestions'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCategories() {
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (fetchError) {
        console.error('Failed to fetch categories:', fetchError)
        setError('Failed to load categories.')
        setLoading(false)
        return
      }
      if (data) {
        setCategories(data)
      }
      setError(null)
      setLoading(false)
    }
    fetchCategories()
  }, [])

  return { categories, loading, error }
}
