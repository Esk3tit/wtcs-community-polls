/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '@/components/auth/AdminGuard'
import { SuggestionForm } from '@/components/suggestions/form/SuggestionForm'

export const Route = createFileRoute('/admin/suggestions/$id/edit')({
  component: EditSuggestionPage,
})

function EditSuggestionPage() {
  const { id } = Route.useParams()
  return (
    <AdminGuard>
      <SuggestionForm mode="edit" pollId={id} />
    </AdminGuard>
  )
}
