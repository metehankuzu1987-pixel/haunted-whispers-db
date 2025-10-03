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
      ai_scan_logs: {
        Row: {
          error_message: string | null
          id: string
          places_added: number | null
          places_found: number | null
          scan_completed_at: string | null
          scan_started_at: string | null
          search_query: string | null
          status: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          places_added?: number | null
          places_found?: number | null
          scan_completed_at?: string | null
          scan_started_at?: string | null
          search_query?: string | null
          status?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          places_added?: number | null
          places_found?: number | null
          scan_completed_at?: string | null
          scan_started_at?: string | null
          search_query?: string | null
          status?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          created_at: string | null
          id: string
          message: string
          nickname: string
          place_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          nickname: string
          place_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          nickname?: string
          place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          created_at: string | null
          id: string
          level: string
          message: string
          meta_json: Json | null
          scope: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          level: string
          message: string
          meta_json?: Json | null
          scope?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          meta_json?: Json | null
          scope?: string | null
        }
        Relationships: []
      }
      moderation: {
        Row: {
          action: string
          actor: string | null
          created_at: string | null
          id: string
          note: string | null
          place_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          place_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_sources: {
        Row: {
          confidence: number | null
          created_at: string | null
          place_id: string
          source_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          place_id: string
          source_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          place_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_sources_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          ai_collected: number | null
          ai_scan_count: number | null
          category: string
          city: string | null
          country_code: string
          created_at: string | null
          description: string | null
          evidence_score: number | null
          first_seen_at: string | null
          human_approved: number | null
          id: string
          last_ai_scan_at: string | null
          last_seen_at: string | null
          lat: number | null
          lon: number | null
          name: string
          osm_id: string | null
          rating_count: number | null
          rating_sum: number | null
          slug: string
          sources_json: Json | null
          status: string | null
          updated_at: string | null
          votes_down: number | null
          votes_up: number | null
          wikidata_id: string | null
        }
        Insert: {
          ai_collected?: number | null
          ai_scan_count?: number | null
          category: string
          city?: string | null
          country_code: string
          created_at?: string | null
          description?: string | null
          evidence_score?: number | null
          first_seen_at?: string | null
          human_approved?: number | null
          id?: string
          last_ai_scan_at?: string | null
          last_seen_at?: string | null
          lat?: number | null
          lon?: number | null
          name: string
          osm_id?: string | null
          rating_count?: number | null
          rating_sum?: number | null
          slug: string
          sources_json?: Json | null
          status?: string | null
          updated_at?: string | null
          votes_down?: number | null
          votes_up?: number | null
          wikidata_id?: string | null
        }
        Update: {
          ai_collected?: number | null
          ai_scan_count?: number | null
          category?: string
          city?: string | null
          country_code?: string
          created_at?: string | null
          description?: string | null
          evidence_score?: number | null
          first_seen_at?: string | null
          human_approved?: number | null
          id?: string
          last_ai_scan_at?: string | null
          last_seen_at?: string | null
          lat?: number | null
          lon?: number | null
          name?: string
          osm_id?: string | null
          rating_count?: number | null
          rating_sum?: number | null
          slug?: string
          sources_json?: Json | null
          status?: string | null
          updated_at?: string | null
          votes_down?: number | null
          votes_up?: number | null
          wikidata_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string | null
          hero_media_type: string | null
          hero_media_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hero_media_type?: string | null
          hero_media_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hero_media_type?: string | null
          hero_media_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          content_hash: string | null
          created_at: string | null
          domain: string | null
          error: string | null
          fetched_at: string | null
          http_status: number | null
          id: string
          next_check_at: string | null
          type: string | null
          url: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          domain?: string | null
          error?: string | null
          fetched_at?: string | null
          http_status?: number | null
          id?: string
          next_check_at?: string | null
          type?: string | null
          url: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          domain?: string | null
          error?: string | null
          fetched_at?: string | null
          http_status?: number | null
          id?: string
          next_check_at?: string | null
          type?: string | null
          url?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      find_similar_places: {
        Args: {
          p_lat?: number
          p_lon?: number
          p_name: string
          p_similarity_threshold?: number
        }
        Returns: {
          distance_km: number
          place_id: string
          place_name: string
          place_slug: string
          similarity_score: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merge_place_sources: {
        Args: { new_sources: Json; target_place_id: string }
        Returns: undefined
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      trigger_active_scan: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
