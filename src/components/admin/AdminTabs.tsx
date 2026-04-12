import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { CategoriesList } from './CategoriesList'
import { AdminsList } from './AdminsList'
import { AdminSuggestionsTab } from './AdminSuggestionsTab'

type TabId = 'suggestions' | 'categories' | 'admins'

export function AdminTabs() {
  // Cast avoids a hard dependency on the compiled route id for tests that mock
  // @tanstack/react-router. The /admin/index route declares validateSearch so
  // at runtime `search.tab` is strictly typed.
  const search = useSearch({ strict: false }) as { tab?: TabId }
  const navigate = useNavigate()
  const active: TabId = search.tab ?? 'suggestions'

  return (
    <Tabs
      value={active}
      onValueChange={(v) =>
        navigate({
          to: '/admin',
          search: { tab: v === 'suggestions' ? undefined : (v as TabId) },
        })
      }
    >
      <TabsList className="w-full">
        <TabsTrigger
          value="suggestions"
          className="flex-1 text-sm font-medium min-h-[44px]"
        >
          Suggestions
        </TabsTrigger>
        <TabsTrigger
          value="categories"
          className="flex-1 text-sm font-medium min-h-[44px]"
        >
          Categories
        </TabsTrigger>
        <TabsTrigger
          value="admins"
          className="flex-1 text-sm font-medium min-h-[44px]"
        >
          Admins
        </TabsTrigger>
      </TabsList>
      <TabsContent value="suggestions" className="pt-6" data-tab="suggestions">
        <AdminSuggestionsTab />
      </TabsContent>
      <TabsContent value="categories" className="pt-6" data-tab="categories">
        <CategoriesList />
      </TabsContent>
      <TabsContent value="admins" className="pt-6" data-tab="admins">
        <AdminsList />
      </TabsContent>
    </Tabs>
  )
}
