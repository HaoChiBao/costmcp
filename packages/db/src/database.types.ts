export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          environment: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          monthly_limit: number | null
          name: string
          permissions: string[]
          project_id: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          monthly_limit?: number | null
          name: string
          permissions?: string[]
          project_id?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          monthly_limit?: number | null
          name?: string
          permissions?: string[]
          project_id?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          alert_thresholds: number[] | null
          amount: number
          created_at: string
          currency: string
          end_date: string | null
          id: string
          name: string
          period: string
          scope_id: string | null
          scope_type: string
          start_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          alert_thresholds?: number[] | null
          amount: number
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          name: string
          period?: string
          scope_id?: string | null
          scope_type: string
          start_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>
        Relationships: []
      }
      collections: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: Partial<Database["public"]["Tables"]["collections"]["Insert"]>
        Relationships: []
      }
      cost_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          workspace_id: string
        }
        Update: Partial<Database["public"]["Tables"]["cost_categories"]["Insert"]>
        Relationships: []
      }
      cost_messages: {
        Row: {
          amount_original: number | null
          amount_usd: number
          batch_id: string | null
          cost_category_id: string | null
          created_at: string
          currency: string
          environment: string | null
          feature: string | null
          id: string
          idempotency_key: string | null
          message_type: string
          metadata: Json
          parent_message_id: string | null
          project_id: string | null
          quantity: number | null
          source: string
          tags: string[]
          unit_cost: number | null
          unit_type: string | null
          vendor_id: string | null
          workspace_id: string
        }
        Insert: {
          amount_original?: number | null
          amount_usd?: number
          batch_id?: string | null
          cost_category_id?: string | null
          created_at?: string
          currency?: string
          environment?: string | null
          feature?: string | null
          id?: string
          idempotency_key?: string | null
          message_type: string
          metadata?: Json
          parent_message_id?: string | null
          project_id?: string | null
          quantity?: number | null
          source?: string
          tags?: string[]
          unit_cost?: number | null
          unit_type?: string | null
          vendor_id?: string | null
          workspace_id: string
        }
        Update: Partial<Database["public"]["Tables"]["cost_messages"]["Insert"]>
        Relationships: []
      }
      pricing_rules: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_workspace_id: string | null
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      projects: {
        Row: {
          archived: boolean
          budget: number | null
          collection_id: string | null
          cost_category_id: string | null
          created_at: string
          currency: string
          description: string | null
          environment: string
          id: string
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          budget?: number | null
          collection_id?: string | null
          cost_category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          environment?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>
        Relationships: []
      }
      vendors: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          invited_email: string | null
          joined_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_email?: string | null
          joined_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Insert"]>
        Relationships: []
      }
      workspaces: {
        Row: {
          base_currency: string
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string | null
          slug: string | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          slug?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      seed_workspace_defaults: { Args: { ws_id: string }; Returns: undefined }
      slugify: { Args: { input: string }; Returns: string }
      user_can_manage_workspace: { Args: { ws_id: string }; Returns: boolean }
      user_workspace_ids: { Args: Record<string, never>; Returns: string[] }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
