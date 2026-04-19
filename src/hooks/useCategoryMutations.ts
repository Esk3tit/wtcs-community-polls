import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { extractFunctionErrorMessage } from '@/lib/fn-error'

export function useCategoryMutations() {
  const [submitting, setSubmitting] = useState(false)

  const create = useCallback(async (name: string) => {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke<{ id: string; name: string }>(
        'create-category',
        { body: { name } },
      )
      if (error) {
        toast.error(await extractFunctionErrorMessage(error, 'Could not create category. Try again.'))
        return { ok: false as const }
      }
      toast.success('Category created')
      return { ok: true as const, category: data }
    } catch {
      toast.error('Could not create category. Try again.')
      return { ok: false as const }
    } finally {
      setSubmitting(false)
    }
  }, [])

  const rename = useCallback(async (category_id: string, name: string) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('rename-category', {
        body: { category_id, name },
      })
      if (error) {
        toast.error(await extractFunctionErrorMessage(error, 'Could not rename category. Try again.'))
        return { ok: false as const }
      }
      toast.success('Category renamed')
      return { ok: true as const }
    } catch {
      toast.error('Could not rename category. Try again.')
      return { ok: false as const }
    } finally {
      setSubmitting(false)
    }
  }, [])

  // Cross-AI LOW fix (D-21): caller MUST pass the real affectedCount
  // (queried via a category_id count against the polls table — see
  // CategoriesList.handleAskDelete) BEFORE calling remove(). Never default
  // to 0 — the count ships into the success toast.
  const remove = useCallback(async (category_id: string, affectedCount: number) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('delete-category', {
        body: { category_id },
      })
      if (error) {
        toast.error(await extractFunctionErrorMessage(error, 'Could not delete category. Try again.'))
        return { ok: false as const }
      }
      if (affectedCount > 0) {
        toast.success(
          `Category deleted. ${affectedCount} suggestion${affectedCount === 1 ? ' is' : 's are'} now uncategorized.`,
        )
      } else {
        toast.success('Category deleted.')
      }
      return { ok: true as const }
    } catch {
      toast.error('Could not delete category. Try again.')
      return { ok: false as const }
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { create, rename, remove, submitting }
}
