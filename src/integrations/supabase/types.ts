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
          category: string | null
          city: string | null
          community_id: string | null
          community_name: string
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          location: string | null
          price: number | null
          ticket_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          community_id?: string | null
          community_name: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date: string
          id?: string
          location?: string | null
          price?: number | null
          ticket_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          community_id?: string | null
          community_name?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          location?: string | null
          price?: number | null
          ticket_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          display_name: string | null
          id: string
          name: string
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
          id?: string
          name: string
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
          id?: string
          name?: string
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
      razorpay_accounts: {
        Row: {
          bank_masked: string | null
          community_id: string
          created_at: string
          error_reason: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          last_updated: string
          onboarding_url: string | null
          razorpay_account_id: string
        }
        Insert: {
          bank_masked?: string | null
          community_id: string
          created_at?: string
          error_reason?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_updated?: string
          onboarding_url?: string | null
          razorpay_account_id: string
        }
        Update: {
          bank_masked?: string | null
          community_id?: string
          created_at?: string
          error_reason?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_updated?: string
          onboarding_url?: string | null
          razorpay_account_id?: string
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
      [_ in never]: never
    }
    Enums: {
      kyc_status:
        | "NOT_STARTED"
        | "IN_PROGRESS"
        | "VERIFIED"
        | "ACTIVATED"
        | "NEEDS_INFO"
        | "REJECTED"
      participant_role: "performer" | "audience"
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
      kyc_status: [
        "NOT_STARTED",
        "IN_PROGRESS",
        "VERIFIED",
        "ACTIVATED",
        "NEEDS_INFO",
        "REJECTED",
      ],
      participant_role: ["performer", "audience"],
    },
  },
} as const
