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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      calendar_connections: {
        Row: {
          access_token: string
          calendar_email: string | null
          calendar_id: string | null
          calendar_name: string | null
          created_at: string | null
          custom_name: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          provider: string
          refresh_token: string | null
          sync_preferences: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_email?: string | null
          calendar_id?: string | null
          calendar_name?: string | null
          created_at?: string | null
          custom_name?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          provider: string
          refresh_token?: string | null
          sync_preferences?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_email?: string | null
          calendar_id?: string | null
          calendar_name?: string | null
          created_at?: string | null
          custom_name?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          refresh_token?: string | null
          sync_preferences?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          google_event_id: string | null
          has_insurance: boolean | null
          id: string
          insurance_name: string | null
          linked_transaction_id: string | null
          location: string | null
          notes: string | null
          organization_id: string | null
          participants: string | null
          reminder_sent: boolean | null
          reminders_sent: Json | null
          scheduled_at: string
          scheduled_reminders: Json | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          has_insurance?: boolean | null
          id?: string
          insurance_name?: string | null
          linked_transaction_id?: string | null
          location?: string | null
          notes?: string | null
          organization_id?: string | null
          participants?: string | null
          reminder_sent?: boolean | null
          reminders_sent?: Json | null
          scheduled_at: string
          scheduled_reminders?: Json | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          has_insurance?: boolean | null
          id?: string
          insurance_name?: string | null
          linked_transaction_id?: string | null
          location?: string | null
          notes?: string | null
          organization_id?: string | null
          participants?: string | null
          reminder_sent?: boolean | null
          reminders_sent?: Json | null
          scheduled_at?: string
          scheduled_reminders?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commitments_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      discount_coupons: {
        Row: {
          code: string
          created_at: string | null
          current_uses: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          note: string | null
          type: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          note?: string | null
          type: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          note?: string | null
          type?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
      }
      eventos: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          organization_id: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          organization_id?: string | null
          start_date: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          organization_id?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_suggestions: {
        Row: {
          created_at: string | null
          description: string
          id: string
          status: string | null
          title: string
          user_id: string
          votes: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          status?: string | null
          title: string
          user_id: string
          votes?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          status?: string | null
          title?: string
          user_id?: string
          votes?: number | null
        }
        Relationships: []
      }
      feature_votes: {
        Row: {
          created_at: string | null
          feature_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feature_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          feature_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      master_users: {
        Row: {
          created_at: string
          email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          permissions: Json | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          permissions?: Json | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          permissions?: Json | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          identifier: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          identifier: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          identifier?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          created_at: string | null
          default_reminders: Json | null
          id: string
          send_via_email: boolean | null
          send_via_whatsapp: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_reminders?: Json | null
          id?: string
          send_via_email?: boolean | null
          send_via_whatsapp?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_reminders?: Json | null
          id?: string
          send_via_email?: boolean | null
          send_via_whatsapp?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          phone_number: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          phone_number?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          phone_number?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          discount_percentage: number | null
          display_name: string
          has_ai_reports: boolean | null
          has_bank_integration: boolean | null
          has_google_calendar: boolean | null
          has_multi_user: boolean | null
          has_priority_support: boolean | null
          has_whatsapp: boolean | null
          id: string
          is_active: boolean | null
          max_categories: number | null
          max_transactions: number | null
          mercadopago_plan_id: string | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          promotion_valid_until: string | null
          promotional_price: number | null
          role: Database["public"]["Enums"]["app_role"]
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          display_name: string
          has_ai_reports?: boolean | null
          has_bank_integration?: boolean | null
          has_google_calendar?: boolean | null
          has_multi_user?: boolean | null
          has_priority_support?: boolean | null
          has_whatsapp?: boolean | null
          id?: string
          is_active?: boolean | null
          max_categories?: number | null
          max_transactions?: number | null
          mercadopago_plan_id?: string | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          promotion_valid_until?: string | null
          promotional_price?: number | null
          role: Database["public"]["Enums"]["app_role"]
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          display_name?: string
          has_ai_reports?: boolean | null
          has_bank_integration?: boolean | null
          has_google_calendar?: boolean | null
          has_multi_user?: boolean | null
          has_priority_support?: boolean | null
          has_whatsapp?: boolean | null
          id?: string
          is_active?: boolean | null
          max_categories?: number | null
          max_transactions?: number | null
          mercadopago_plan_id?: string | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          promotion_valid_until?: string | null
          promotional_price?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          organization_id: string | null
          source: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          source?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          organization_id?: string | null
          source?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_coupons: {
        Row: {
          applied_at: string | null
          coupon_id: string
          id: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          coupon_id: string
          id?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          coupon_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string | null
          cancel_at_period_end: boolean | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mercadopago_customer_id: string | null
          mercadopago_subscription_id: string | null
          payment_gateway: string | null
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mercadopago_customer_id?: string | null
          mercadopago_subscription_id?: string | null
          payment_gateway?: string | null
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mercadopago_customer_id?: string | null
          mercadopago_subscription_id?: string | null
          payment_gateway?: string | null
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_auth_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string | null
          id: string
          phone_number: string
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          phone_number: string
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          phone_number?: string
          used?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          last_activity: string | null
          phone_number: string
          session_data: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_activity?: string | null
          phone_number: string
          session_data?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_activity?: string | null
          phone_number?: string
          session_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      work_hours: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_exists: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      clean_duplicate_profiles: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_whatsapp_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_security_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_rate_limit_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_cron_jobs_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          jobname: string
          last_run: string
          schedule: string
        }[]
      }
      get_user_active_plan: {
        Args: { _user_id: string }
        Returns: {
          has_ai_reports: boolean
          has_bank_integration: boolean
          has_google_calendar: boolean
          has_multi_user: boolean
          has_priority_support: boolean
          has_whatsapp: boolean
          max_categories: number
          max_transactions: number
          plan_name: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_org_role: {
        Args: { _org_id: string; _role: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master_user: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_whatsapp_authenticated: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "premium" | "free" | "trial"
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
      app_role: ["admin", "premium", "free", "trial"],
    },
  },
} as const
