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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      communities: {
        Row: {
          banner_url: string | null
          categories: string[]
          created_at: string
          description: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          categories?: string[]
          created_at?: string
          description?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          categories?: string[]
          created_at?: string
          description?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_invites: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          invite_code: string
          max_uses: number | null
          uses_count: number
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          invite_code: string
          max_uses?: number | null
          uses_count?: number
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          invite_code?: string
          max_uses?: number | null
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_invites_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_messages: {
        Row: {
          community_id: string
          content: string
          created_at: string
          id: string
          message_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          community_id: string
          content: string
          created_at?: string
          id?: string
          message_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          community_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      event_audit_log: {
        Row: {
          action: string
          created_at: string
          event_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          event_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_audit_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notifications: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_read: boolean
          message: string
          notification_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          event_id: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["participant_role"]
          ticket_code: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string | null
          role: Database["public"]["Enums"]["participant_role"]
          ticket_code?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          ticket_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          audience_enabled: boolean | null
          audience_slots: number | null
          audience_ticket_price: number | null
          category: string | null
          city: string | null
          community_id: string | null
          community_name: string
          created_at: string | null
          created_by: string | null
          description: string | null
          duration: number | null
          editable_before_event_minutes: number | null
          event_date: string
          id: string
          is_cancelled: boolean | null
          location: string | null
          meeting_link_last_updated_at: string | null
          meeting_url: string | null
          performer_slots: number
          performer_ticket_price: number
          poster_url: string | null
          price: number | null
          ticket_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          audience_enabled?: boolean | null
          audience_slots?: number | null
          audience_ticket_price?: number | null
          category?: string | null
          city?: string | null
          community_id?: string | null
          community_name: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration?: number | null
          editable_before_event_minutes?: number | null
          event_date: string
          id?: string
          is_cancelled?: boolean | null
          location?: string | null
          meeting_link_last_updated_at?: string | null
          meeting_url?: string | null
          performer_slots?: number
          performer_ticket_price?: number
          poster_url?: string | null
          price?: number | null
          ticket_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          audience_enabled?: boolean | null
          audience_slots?: number | null
          audience_ticket_price?: number | null
          category?: string | null
          city?: string | null
          community_id?: string | null
          community_name?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration?: number | null
          editable_before_event_minutes?: number | null
          event_date?: string
          id?: string
          is_cancelled?: boolean | null
          location?: string | null
          meeting_link_last_updated_at?: string | null
          meeting_url?: string | null
          performer_slots?: number
          performer_ticket_price?: number
          poster_url?: string | null
          price?: number | null
          ticket_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          community_id: string
          document_name: string
          document_type: string
          error_message: string | null
          id: string
          razorpay_account_id: string
          stakeholder_id: string
          upload_status: string
          uploaded_at: string | null
        }
        Insert: {
          community_id: string
          document_name: string
          document_type: string
          error_message?: string | null
          id?: string
          razorpay_account_id: string
          stakeholder_id: string
          upload_status?: string
          uploaded_at?: string | null
        }
        Update: {
          community_id?: string
          document_name?: string
          document_type?: string
          error_message?: string | null
          id?: string
          razorpay_account_id?: string
          stakeholder_id?: string
          upload_status?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          display_name: string | null
          dob: string | null
          id: string
          name: string
          pan: string | null
          phone: string | null
          postal_code: string | null
          profile_picture_url: string | null
          skills: string[] | null
          state: string | null
          street1: string | null
          street2: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          dob?: string | null
          id?: string
          name: string
          pan?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_picture_url?: string | null
          skills?: string[] | null
          state?: string | null
          street1?: string | null
          street2?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          dob?: string | null
          id?: string
          name?: string
          pan?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_picture_url?: string | null
          skills?: string[] | null
          state?: string | null
          street1?: string | null
          street2?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      promocodes: {
        Row: {
          applies_to: string
          code: string
          created_at: string | null
          discount_type: string
          discount_value: number
          event_id: string
          id: string
          usage_count: number | null
          usage_limit: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to: string
          code: string
          created_at?: string | null
          discount_type: string
          discount_value: number
          event_id: string
          id?: string
          usage_count?: number | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to?: string
          code?: string
          created_at?: string | null
          discount_type?: string
          discount_value?: number
          event_id?: string
          id?: string
          usage_count?: number | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promocodes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      razorpay_accounts: {
        Row: {
          bank_account_number: string | null
          bank_beneficiary_name: string | null
          bank_ifsc: string | null
          bank_masked: string | null
          business_type: string | null
          community_id: string
          created_at: string
          error_reason: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          last_updated: string
          legal_business_name: string | null
          onboarding_url: string | null
          product_id: string | null
          products_activated: boolean | null
          products_requested: boolean | null
          razorpay_account_id: string
          stakeholder_id: string | null
          tnc_accepted: boolean | null
          tnc_accepted_at: string | null
        }
        Insert: {
          bank_account_number?: string | null
          bank_beneficiary_name?: string | null
          bank_ifsc?: string | null
          bank_masked?: string | null
          business_type?: string | null
          community_id: string
          created_at?: string
          error_reason?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_updated?: string
          legal_business_name?: string | null
          onboarding_url?: string | null
          product_id?: string | null
          products_activated?: boolean | null
          products_requested?: boolean | null
          razorpay_account_id: string
          stakeholder_id?: string | null
          tnc_accepted?: boolean | null
          tnc_accepted_at?: string | null
        }
        Update: {
          bank_account_number?: string | null
          bank_beneficiary_name?: string | null
          bank_ifsc?: string | null
          bank_masked?: string | null
          business_type?: string | null
          community_id?: string
          created_at?: string
          error_reason?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_updated?: string
          legal_business_name?: string | null
          onboarding_url?: string | null
          product_id?: string | null
          products_activated?: boolean | null
          products_requested?: boolean | null
          razorpay_account_id?: string
          stakeholder_id?: string | null
          tnc_accepted?: boolean | null
          tnc_accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "razorpay_accounts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: true
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          context_id: string | null
          context_type:
            | Database["public"]["Enums"]["report_context_type"]
            | null
          created_at: string
          id: string
          incident_location: string | null
          message: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_type: Database["public"]["Enums"]["report_target_type"]
          target_user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type?:
            | Database["public"]["Enums"]["report_context_type"]
            | null
          created_at?: string
          id?: string
          incident_location?: string | null
          message: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_type: Database["public"]["Enums"]["report_target_type"]
          target_user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?:
            | Database["public"]["Enums"]["report_context_type"]
            | null
          created_at?: string
          id?: string
          incident_location?: string | null
          message?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_type?: Database["public"]["Enums"]["report_target_type"]
          target_user_id?: string
        }
        Relationships: []
      }
      spotlights: {
        Row: {
          community_name: string
          created_at: string | null
          event_id: string | null
          feature_text: string
          id: string
          user_id: string
        }
        Insert: {
          community_name: string
          created_at?: string | null
          event_id?: string | null
          feature_text: string
          id?: string
          user_id: string
        }
        Update: {
          community_name?: string
          created_at?: string | null
          event_id?: string | null
          feature_text?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlights_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          name: string | null
          profile_picture_url: string | null
          skills: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          name?: string | null
          profile_picture_url?: string | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          name?: string | null
          profile_picture_url?: string | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      event_has_bookings: { Args: { _event_id: string }; Returns: boolean }
      get_community_member_count: {
        Args: { p_community_id: string }
        Returns: number
      }
      get_event_booking_count: { Args: { _event_id: string }; Returns: number }
      get_event_details: {
        Args: { _event_id: string; _user_id?: string }
        Returns: {
          audience_enabled: boolean
          audience_slots: number
          audience_ticket_price: number
          category: string
          city: string
          community_id: string
          community_name: string
          created_at: string
          created_by: string
          description: string
          duration: number
          event_date: string
          id: string
          location: string
          meeting_url: string
          performer_slots: number
          performer_ticket_price: number
          poster_url: string
          price: number
          ticket_type: string
          title: string
          updated_at: string
        }[]
      }
      get_reports_admin: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          context_id: string
          context_type: string
          created_at: string
          id: string
          message: string
          reason: string
          reporter_id: string
          reporter_name: string
          status: string
          target_name: string
          target_type: string
          target_user_id: string
        }[]
      }
      get_user_report_count: {
        Args: { p_days?: number; p_user_id: string }
        Returns: number
      }
      has_recent_report: {
        Args: { _reporter_id: string; _target_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_community_member: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      is_community_owner: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      kyc_status:
        | "NOT_STARTED"
        | "IN_PROGRESS"
        | "VERIFIED"
        | "ACTIVATED"
        | "NEEDS_INFO"
        | "REJECTED"
      participant_role: "performer" | "audience"
      report_context_type: "event" | "chat" | "profile" | "community"
      report_status: "pending" | "reviewed" | "resolved"
      report_target_type: "user" | "community_owner"
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
      app_role: ["admin", "moderator", "user"],
      kyc_status: [
        "NOT_STARTED",
        "IN_PROGRESS",
        "VERIFIED",
        "ACTIVATED",
        "NEEDS_INFO",
        "REJECTED",
      ],
      participant_role: ["performer", "audience"],
      report_context_type: ["event", "chat", "profile", "community"],
      report_status: ["pending", "reviewed", "resolved"],
      report_target_type: ["user", "community_owner"],
    },
  },
} as const
