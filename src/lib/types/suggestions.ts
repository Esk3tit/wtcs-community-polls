import type { Tables } from '@/lib/types/database.types'

// Base row types from database
export type Poll = Tables<'polls'>
export type Category = Tables<'categories'>
export type Choice = Tables<'choices'>
export type Vote = Tables<'votes'>
export type VoteCount = Tables<'vote_counts'>
export type Profile = Tables<'profiles'>

// Shared select clause — single source of truth for suggestion queries
export const SUGGESTIONS_SELECT = `
  *,
  categories!polls_category_id_fkey(id, name, slug, sort_order),
  choices(id, label, sort_order)
` as const

// Matches the shape returned by SUGGESTIONS_SELECT query
export type SuggestionWithChoices = Poll & {
  categories: Pick<Category, 'id' | 'name' | 'slug' | 'sort_order'> | null
  choices: ChoiceSummary[]
}

// Narrowed choice type for components that only need display fields
export interface ChoiceSummary {
  id: string
  label: string
  sort_order: number
}

export interface ChoiceWithCount {
  id: string
  label: string
  sort_order: number
  count: number
  percentage: number
  isUserChoice: boolean
}

export type ResolutionStatus = 'addressed' | 'forwarded' | 'closed'

// Category badge color slots (4 colors, assigned by index % 4)
export const CATEGORY_COLORS = [
  { light: 'bg-blue-50 text-blue-700', dark: 'dark:bg-blue-500/25 dark:text-blue-300' },
  { light: 'bg-teal-50 text-teal-700', dark: 'dark:bg-teal-500/25 dark:text-teal-300' },
  { light: 'bg-purple-50 text-purple-700', dark: 'dark:bg-purple-500/25 dark:text-purple-300' },
  { light: 'bg-rose-50 text-rose-700', dark: 'dark:bg-rose-500/25 dark:text-rose-300' },
] as const

export function getCategoryColor(index: number) {
  const slot = CATEGORY_COLORS[Math.abs(index) % CATEGORY_COLORS.length]
  return `${slot.light} ${slot.dark}`
}
