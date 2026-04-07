import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/lib/types/suggestions'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Failed to fetch categories:', error)
      }
      if (data) {
        setCategories(data)
      }
      setLoading(false)
    }
    fetchCategories()
  }, [])

  return { categories, loading }
}
