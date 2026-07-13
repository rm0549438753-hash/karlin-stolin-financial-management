export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          schema_type: string
          sheet_key: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          schema_type?: string
          sheet_key?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          schema_type?: string
          sheet_key?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      action_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          created_at: string
          current_table: string | null
          error_message: string | null
          file_id: string | null
          file_name: string | null
          finished_at: string | null
          folder_id: string | null
          heartbeat_at: string
          id: string
          processed_rows: number
          row_counts: Json | null
          size_bytes: number | null
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          created_at?: string
          current_table?: string | null
          error_message?: string | null
          file_id?: string | null
          file_name?: string | null
          finished_at?: string | null
          folder_id?: string | null
          heartbeat_at?: string
          id?: string
          processed_rows?: number
          row_counts?: Json | null
          size_bytes?: number | null
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          created_at?: string
          current_table?: string | null
          error_message?: string | null
          file_id?: string | null
          file_name?: string | null
          finished_at?: string | null
          folder_id?: string | null
          heartbeat_at?: string
          id?: string
          processed_rows?: number
          row_counts?: Json | null
          size_bytes?: number | null
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      check_email_runs: {
        Row: {
          check_count: number
          error_message: string | null
          for_date: string
          id: string
          ran_at: string
          status: string
          total_amount: number
          triggered_by: string
        }
        Insert: {
          check_count?: number
          error_message?: string | null
          for_date: string
          id?: string
          ran_at?: string
          status: string
          total_amount?: number
          triggered_by?: string
        }
        Update: {
          check_count?: number
          error_message?: string | null
          for_date?: string
          id?: string
          ran_at?: string
          status?: string
          total_amount?: number
          triggered_by?: string
        }
        Relationships: []
      }
      check_email_settings: {
        Row: {
          body_intro: string
          body_outro: string
          id: string
          include_association: boolean
          include_note: boolean
          recipients: string[]
          send_when_empty: boolean
          singleton: boolean
          subject_template: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_intro?: string
          body_outro?: string
          id?: string
          include_association?: boolean
          include_note?: boolean
          recipients?: string[]
          send_when_empty?: boolean
          singleton?: boolean
          subject_template?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_intro?: string
          body_outro?: string
          id?: string
          include_association?: boolean
          include_note?: boolean
          recipients?: string[]
          send_when_empty?: boolean
          singleton?: boolean
          subject_template?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      expense_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      fund_opening_balances: {
        Row: {
          amount: number
          created_at: string
          fund_id: string
          id: string
          note: string | null
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          fund_id: string
          id?: string
          note?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          fund_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fund_opening_balances_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      funds: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_vault: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_vault?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_vault?: boolean
          name?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          row_count: number
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          row_count?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          row_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_ignores: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          ref_key: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          note?: string | null
          ref_key?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          ref_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_ignores_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          association: string | null
          balance: number | null
          category_id: string | null
          channel: string | null
          created_at: string
          created_by: string | null
          credit: number | null
          debit: number | null
          description: string | null
          expense_type_id: string | null
          fee: number | null
          fund_id: string | null
          future_check: boolean | null
          id: string
          import_batch_id: string | null
          note: string | null
          operation_code: string | null
          operation_type: string | null
          payee: string | null
          payer_name: string | null
          reference: string | null
          subcategory_id: string | null
          transaction_date: string | null
          updated_at: string
          updated_by: string | null
          value_date: string | null
        }
        Insert: {
          account_id: string
          amount: number
          association?: string | null
          balance?: number | null
          category_id?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          expense_type_id?: string | null
          fee?: number | null
          fund_id?: string | null
          future_check?: boolean | null
          id?: string
          import_batch_id?: string | null
          note?: string | null
          operation_code?: string | null
          operation_type?: string | null
          payee?: string | null
          payer_name?: string | null
          reference?: string | null
          subcategory_id?: string | null
          transaction_date?: string | null
          updated_at?: string
          updated_by?: string | null
          value_date?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          association?: string | null
          balance?: number | null
          category_id?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          expense_type_id?: string | null
          fee?: number | null
          fund_id?: string | null
          future_check?: boolean | null
          id?: string
          import_batch_id?: string | null
          note?: string | null
          operation_code?: string | null
          operation_type?: string | null
          payee?: string | null
          payer_name?: string | null
          reference?: string | null
          subcategory_id?: string | null
          transaction_date?: string | null
          updated_at?: string
          updated_by?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      undo_action_history: {
        Args: { p_history_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "viewer"],
    },
  },
} as const
