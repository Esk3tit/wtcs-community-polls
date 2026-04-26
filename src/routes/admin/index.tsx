/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '@/components/auth/AdminGuard'
import { AdminTabs } from '@/components/admin/AdminTabs'
import { SentrySmokeButton } from '@/components/admin/SentrySmokeButton'

const VALID_TABS = ['suggestions', 'categories', 'admins'] as const
const VALID_FILTERS = ['active', 'closed', 'all'] as const
type AdminTab = (typeof VALID_TABS)[number]
type AdminFilter = (typeof VALID_FILTERS)[number]
type AdminSearch = { tab?: AdminTab; filter?: AdminFilter }

export const Route = createFileRoute('/admin/')({
  component: AdminPage,
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    tab: VALID_TABS.includes(search.tab as AdminTab)
      ? (search.tab as AdminTab)
      : undefined,
    filter: VALID_FILTERS.includes(search.filter as AdminFilter)
      ? (search.filter as AdminFilter)
      : undefined,
  }),
})

function AdminPage() {
  return (
    <AdminGuard>
      {/* Phase 6 D-08 (R-02): smoke component lives behind AdminGuard.
          Non-admins are redirected by AdminGuard before this component mounts.
          This whole edit is on the deploy-preview branch phase6-d08-smoke and
          is removed (entire branch deletion) after Sentry symbolication
          verification. */}
      <SentrySmokeButton />
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <h1 className="text-2xl font-semibold mb-6">Admin</h1>
        <AdminTabs />
      </div>
    </AdminGuard>
  )
}
