export type Database = {
  public: {
    Tables: {
      admin_discord_ids: {
        Row: { discord_id: string; added_at: string }
        Insert: { discord_id: string; added_at?: string }
        Update: Record<string, never>
      }
      profiles: {
        Row: {
          id: string
          discord_id: string
          discord_username: string
          avatar_url: string | null
          is_admin: boolean
          mfa_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          discord_id: string
          discord_username: string
          avatar_url?: string | null
          is_admin?: boolean
          mfa_verified?: boolean
        }
        Update: {
          discord_username?: string
          avatar_url?: string | null
          // mfa_verified intentionally EXCLUDED -- set via RPC only (R2 fix)
          // id, discord_id, is_admin, created_at protected by database-level guards
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
          created_at: string
        }
        Insert: { id?: string; name: string; slug: string; sort_order?: number }
        Update: { name?: string; slug?: string; sort_order?: number }
      }
      polls: {
        Row: {
          id: string
          title: string
          description: string | null
          category_id: string | null
          image_url: string | null
          status: 'active' | 'closed'
          resolution: 'addressed' | 'forwarded' | 'closed' | null
          is_pinned: boolean
          created_by: string
          closes_at: string
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          category_id?: string | null
          image_url?: string | null
          status?: 'active' | 'closed'
          resolution?: 'addressed' | 'forwarded' | 'closed' | null
          is_pinned?: boolean
          created_by: string
          closes_at: string
        }
        Update: {
          title?: string
          description?: string | null
          category_id?: string | null
          image_url?: string | null
          status?: 'active' | 'closed'
          resolution?: 'addressed' | 'forwarded' | 'closed' | null
          is_pinned?: boolean
          closes_at?: string
          closed_at?: string | null
        }
      }
      choices: {
        Row: {
          id: string
          poll_id: string
          label: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          poll_id: string
          label: string
          sort_order?: number
        }
        Update: { label?: string; sort_order?: number }
      }
      votes: {
        Row: {
          id: string
          poll_id: string
          choice_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          poll_id: string
          choice_id: string
          user_id: string
        }
        Update: Record<string, never>
      }
      vote_counts: {
        Row: {
          id: string
          poll_id: string
          choice_id: string
          count: number
        }
        Insert: {
          id?: string
          poll_id: string
          choice_id: string
          count?: number
        }
        Update: { count?: number }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
