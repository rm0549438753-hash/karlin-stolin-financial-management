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
      action_history_archive: {
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
      app_download_settings: {
        Row: {
          code_cipher: string | null
          code_hash: string | null
          id: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code_cipher?: string | null
          code_hash?: string | null
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code_cipher?: string | null
          code_hash?: string | null
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
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
      blocked_ips: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ip: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip?: string
          reason?: string | null
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
      classification_applications: {
        Row: {
          applied_by: string | null
          changed: Json
          created_at: string
          id: string
          previous: Json
          reverted_at: string | null
          rule_id: string
          transaction_id: string
        }
        Insert: {
          applied_by?: string | null
          changed?: Json
          created_at?: string
          id?: string
          previous?: Json
          reverted_at?: string | null
          rule_id: string
          transaction_id: string
        }
        Update: {
          applied_by?: string | null
          changed?: Json
          created_at?: string
          id?: string
          previous?: Json
          reverted_at?: string | null
          rule_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_applications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "classification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_applications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_rules: {
        Row: {
          account_id: string | null
          amount_max: number | null
          amount_min: number | null
          applied_count: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          match_field: string
          match_smart: boolean
          match_text: string | null
          match_whole_word: boolean
          mode: string
          name: string
          priority: number
          set_category_id: string | null
          set_expense_type_id: string | null
          set_fund_id: string | null
          set_subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_max?: number | null
          amount_min?: number | null
          applied_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          match_field?: string
          match_smart?: boolean
          match_text?: string | null
          match_whole_word?: boolean
          mode?: string
          name: string
          priority?: number
          set_category_id?: string | null
          set_expense_type_id?: string | null
          set_fund_id?: string | null
          set_subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_max?: number | null
          amount_min?: number | null
          applied_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          match_field?: string
          match_smart?: boolean
          match_text?: string | null
          match_whole_word?: boolean
          mode?: string
          name?: string
          priority?: number
          set_category_id?: string | null
          set_expense_type_id?: string | null
          set_fund_id?: string | null
          set_subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_set_category_id_fkey"
            columns: ["set_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_set_expense_type_id_fkey"
            columns: ["set_expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_set_fund_id_fkey"
            columns: ["set_fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_set_subcategory_id_fkey"
            columns: ["set_subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_suggestions: {
        Row: {
          created_at: string
          id: string
          rule_id: string
          status: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rule_id: string
          status?: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rule_id?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_suggestions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "classification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_suggestions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_runs: {
        Row: {
          automation_id: string | null
          error_message: string | null
          id: string
          ran_at: string
          recipients: string[]
          status: string
          summary: string | null
          triggered_by: string
        }
        Insert: {
          automation_id?: string | null
          error_message?: string | null
          id?: string
          ran_at?: string
          recipients?: string[]
          status: string
          summary?: string | null
          triggered_by?: string
        }
        Update: {
          automation_id?: string | null
          error_message?: string | null
          id?: string
          ran_at?: string
          recipients?: string[]
          status?: string
          summary?: string | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          body_intro: string
          body_outro: string
          button_text: string | null
          button_url: string | null
          created_at: string
          days_ahead: number | null
          frequency: string
          id: string
          include_association: boolean
          include_note: boolean
          is_active: boolean
          is_builtin: boolean
          last_run_at: string | null
          name: string
          recipients: string[]
          send_hour: number
          send_when_empty: boolean
          subject_template: string
          threshold_value: number | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          body_intro?: string
          body_outro?: string
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          days_ahead?: number | null
          frequency?: string
          id?: string
          include_association?: boolean
          include_note?: boolean
          is_active?: boolean
          is_builtin?: boolean
          last_run_at?: string | null
          name: string
          recipients?: string[]
          send_hour?: number
          send_when_empty?: boolean
          subject_template?: string
          threshold_value?: number | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          body_intro?: string
          body_outro?: string
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          days_ahead?: number | null
          frequency?: string
          id?: string
          include_association?: boolean
          include_note?: boolean
          is_active?: boolean
          is_builtin?: boolean
          last_run_at?: string | null
          name?: string
          recipients?: string[]
          send_hour?: number
          send_when_empty?: boolean
          subject_template?: string
          threshold_value?: number | null
          trigger_type?: string
          updated_at?: string
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
      failed_login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
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
      login_events: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_key: string | null
          email: string | null
          event_type: string
          id: string
          ip: string | null
          is_new_device: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_key?: string | null
          email?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          is_new_device?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_key?: string | null
          email?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          is_new_device?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          blocked: boolean
          created_at: string
          email: string | null
          full_name: string | null
          full_view: boolean
          id: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          full_view?: boolean
          id: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          full_view?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_notification_rules: {
        Row: {
          body_template: string
          created_at: string
          created_by: string | null
          days_before: number
          id: string
          is_active: boolean
          link: string
          link_label: string
          min_amount: number | null
          name: string
          send_hour: number
          send_minute: number
          sort_order: number
          title_template: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          body_template?: string
          created_at?: string
          created_by?: string | null
          days_before?: number
          id?: string
          is_active?: boolean
          link?: string
          link_label?: string
          min_amount?: number | null
          name: string
          send_hour?: number
          send_minute?: number
          sort_order?: number
          title_template?: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          created_by?: string | null
          days_before?: number
          id?: string
          is_active?: boolean
          link?: string
          link_label?: string
          min_amount?: number | null
          name?: string
          send_hour?: number
          send_minute?: number
          sort_order?: number
          title_template?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_accepted_findings: {
        Row: {
          accepted_by: string | null
          created_at: string
          finding_key: string
          id: string
          reason: string
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          finding_key: string
          id?: string
          reason?: string
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          finding_key?: string
          id?: string
          reason?: string
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_runs: {
        Row: {
          critical_count: number
          error_message: string | null
          high_count: number
          id: string
          low_count: number
          moderate_count: number
          ran_at: string
          report_json: Json | null
          status: string
          total_dependencies: number
          triggered_by: string
        }
        Insert: {
          critical_count?: number
          error_message?: string | null
          high_count?: number
          id?: string
          low_count?: number
          moderate_count?: number
          ran_at?: string
          report_json?: Json | null
          status?: string
          total_dependencies?: number
          triggered_by?: string
        }
        Update: {
          critical_count?: number
          error_message?: string | null
          high_count?: number
          id?: string
          low_count?: number
          moderate_count?: number
          ran_at?: string
          report_json?: Json | null
          status?: string
          total_dependencies?: number
          triggered_by?: string
        }
        Relationships: []
      }
      security_memory: {
        Row: {
          content: string
          id: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
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
      actor_names: {
        Args: { _ids: string[] }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      archive_old_action_history: { Args: never; Returns: number }
      dashboard_rows: { Args: never; Returns: Json }
      dashboard_rows_compact: { Args: never; Returns: Json }
      get_cron_hook_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_full_viewer: { Args: { _uid: string }; Returns: boolean }
      portability_schema: { Args: never; Returns: Json }
      security_config_autofix: { Args: never; Returns: Json }
      security_config_findings: { Args: never; Returns: Json }
      tx_alert_counts: { Args: never; Returns: Json }
      undo_action_history: {
        Args: { p_history_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer" | "superadmin"
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
      app_role: ["admin", "editor", "viewer", "superadmin"],
    },
  },
} as const
