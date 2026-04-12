/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '@/components/auth/AdminGuard'
import { SuggestionForm } from '@/components/suggestions/form/SuggestionForm'

export const Route = createFileRoute('/admin/suggestions/new')({
  component: NewSuggestionPage,
})

function NewSuggestionPage() {
  return (
    <AdminGuard>
      <SuggestionForm mode="create" />
    </AdminGuard>
  )
}
