export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          base_currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          base_currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          slug: string;
          name: string;
          description: string | null;
          status: string;
          budget: number | null;
          currency: string;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          slug: string;
          name: string;
          description?: string | null;
          status?: string;
          budget?: number | null;
          currency?: string;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      vendors: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      cost_messages: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          vendor_id: string | null;
          message_type: string;
          amount_usd: number;
          currency: string;
          amount_original: number | null;
          unit_type: string | null;
          quantity: number | null;
          unit_cost: number | null;
          feature: string | null;
          batch_id: string | null;
          environment: string | null;
          source: string;
          idempotency_key: string | null;
          parent_message_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          projects?: { slug: string; name: string } | { slug: string; name: string }[] | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          vendor_id?: string | null;
          message_type: string;
          amount_usd?: number;
          currency?: string;
          amount_original?: number | null;
          unit_type?: string | null;
          quantity?: number | null;
          unit_cost?: number | null;
          feature?: string | null;
          batch_id?: string | null;
          environment?: string | null;
          source?: string;
          idempotency_key?: string | null;
          parent_message_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cost_messages"]["Insert"]>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          workspace_id: string;
          scope_type: string;
          scope_id: string | null;
          name: string;
          amount: number;
          currency: string;
          period: string;
          alert_thresholds: number[] | null;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          name: string;
          key_prefix: string;
          key_hash: string;
          permissions: string[];
          environment: string;
          monthly_limit: number | null;
          last_used_at: string | null;
          status: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      pricing_rules: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
