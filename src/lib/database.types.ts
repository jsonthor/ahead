export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRow = {
  id: string;
  display_name: string;
  timezone: string;
  units: "metric" | "imperial";
  date_of_birth: string | null;
  onboarding: Json | null;
  potential_calibration: Json | null;
  assistant_memory: Json | null;
  hr_zone_notices: Json;
  created_at: string;
  updated_at: string;
};

type IntegrationSyncRow = {
  id: string;
  athlete_id: string;
  provider: string;
  started_at: string;
  finished_at: string;
  status: string;
  activities_saved: number | null;
  recovery_days: number | null;
  message: string | null;
  created_at: string;
};

type IntegrationRow = {
  id: string;
  athlete_id: string;
  provider: string;
  status: string;
  external_user_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  token_type: string | null;
  scope: string | null;
  mcp_url: string | null;
  last_sync_at: string | null;
  cursor: string | null;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  athlete_id: string;
  source: string;
  source_activity_id: string;
  sport: string;
  subsport: string | null;
  started_at: string;
  duration_seconds: number | null;
  elapsed_seconds: number | null;
  moving_seconds: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  max_power: number | null;
  normalized_power: number | null;
  avg_cadence: number | null;
  avg_speed_mps: number | null;
  session_type: string | null;
  session_importance: string | null;
  rpe: number | null;
  raw_fit_key: string | null;
  vendor: Json | null;
  intelligence_eligible: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

type ActivityLapRow = {
  id: string;
  activity_id: string;
  athlete_id: string;
  source_index: number;
  started_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  avg_power: number | null;
  created_at: string;
};

type WellnessDayRow = {
  id: string;
  athlete_id: string;
  date: string;
  resting_hr: number | null;
  sleep_minutes: number | null;
  hrv_ms: number | null;
  stress: number | null;
  source: string;
  vendor: Json | null;
  created_at: string;
  updated_at: string;
};

type DailyRecoveryRow = {
  id: string;
  athlete_id: string;
  date: string;
  source: string;
  resting_hr: number | null;
  sleep_hrv_ms: number | null;
  sleep_minutes: number | null;
  sleep_score: number | null;
  stress_avg: number | null;
  created_at: string;
  updated_at: string;
};

type CalendarItemRow = {
  id: string;
  athlete_id: string;
  date: string;
  sport: string;
  title: string;
  intent: string;
  importance: string | null;
  planned_seconds: number | null;
  planned_distance_m: number | null;
  planned_load: number | null;
  purpose: string | null;
  created_by: string;
  workout: Json | null;
  notes: string | null;
  linked_activity_id: string | null;
  created_at: string;
  updated_at: string;
};

type ConversationRow = {
  id: string;
  athlete_id: string;
  title: string | null;
  openai_response_id: string | null;
  memory_extracted_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  athlete_id: string;
  role: string;
  content: string;
  proposal: Json | null;
  proposal_id: string | null;
  created_at: string;
};

type AthleteMemoryRow = {
  id: string;
  athlete_id: string;
  type: string;
  content: string;
  confidence: number;
  importance: number;
  source_conversation_id: string | null;
  created_at: string;
  updated_at: string;
  superseded_at: string | null;
};

type CalendarProposalRow = {
  id: string;
  athlete_id: string;
  conversation_id: string | null;
  operations: Json;
  snapshot: Json;
  rationale: string;
  status: string;
  created_at: string;
  applied_at: string | null;
  expires_at: string;
};

type AgentActionRow = {
  id: string;
  athlete_id: string;
  proposal_id: string | null;
  conversation_id: string | null;
  operations: Json;
  result: Json;
  created_at: string;
  undone_at: string | null;
};

type AthleteHrModelRow = {
  id: string;
  athlete_id: string;
  hr_max: number;
  source: string;
  confidence: string;
  cycling_lthr: number | null;
  running_lthr: number | null;
  threshold_source: string | null;
  threshold_confidence: string | null;
  valid_from: string;
  valid_to: string | null;
  provider: string | null;
  provider_value_reference: string | null;
  created_at: string;
  updated_at: string;
};

type ActivitySessionNoteRow = {
  activity_id: string;
  athlete_id: string;
  note: Json;
  composed_at: string;
  updated_at: string;
};

type CoachReviewRow = {
  id: string;
  athlete_id: string;
  kind: string;
  period_start: string;
  period_end: string;
  source: string | null;
  title: string;
  review: Json;
  created_at: string;
  completed_at: string;
  updated_at: string;
};

type DailyLoadRow = {
  id: string;
  athlete_id: string;
  date: string;
  training_load: number | null;
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
  aerobic_reserve: number | null;
  specific_capacity: number | null;
  aerobic_raw: number | null;
  specific_raw: number | null;
  acute_fatigue: number | null;
  development: number | null;
  potential: number | null;
  race_readiness: number | null;
  data_quality: string | null;
  status: string | null;
  formula_version: string | null;
  created_at: string;
  updated_at: string;
};

type RouteClusterRow = {
  id: string;
  athlete_id: string;
  sport: string;
  representative_activity_id: string;
  typical_distance_m: number | null;
  typical_elevation_m: number | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
};

type ActivityRouteRow = {
  activity_id: string;
  athlete_id: string;
  sport: string;
  distance_m: number;
  elevation_m: number | null;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  bbox_min_lat: number;
  bbox_min_lng: number;
  bbox_max_lat: number;
  bbox_max_lng: number;
  points: Json;
  route_cluster_id: string | null;
  route_similarity: number | null;
  route_overlap: number | null;
  direction_match: boolean | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          display_name: string;
          timezone?: string;
          units?: "metric" | "imperial";
          date_of_birth?: string | null;
          onboarding?: Json | null;
          potential_calibration?: Json | null;
          assistant_memory?: Json | null;
          hr_zone_notices?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      integrations: {
        Row: IntegrationRow;
        Insert: {
          id?: string;
          athlete_id: string;
          provider: string;
          status?: string;
          external_user_id?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          token_type?: string | null;
          scope?: string | null;
          mcp_url?: string | null;
          last_sync_at?: string | null;
          cursor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<IntegrationRow>;
        Relationships: [];
      };
      integration_syncs: {
        Row: IntegrationSyncRow;
        Insert: {
          id?: string;
          athlete_id: string;
          provider: string;
          started_at: string;
          finished_at?: string;
          status?: string;
          activities_saved?: number | null;
          recovery_days?: number | null;
          message?: string | null;
          created_at?: string;
        };
        Update: Partial<IntegrationSyncRow>;
        Relationships: [];
      };
      oauth_handoffs: {
        Row: {
          state: string;
          athlete_id: string;
          return_path: string;
          mcp_url: string | null;
          code_verifier: string | null;
          discovery_state: Json | null;
          expires_at: string;
        };
        Insert: {
          state: string;
          athlete_id: string;
          return_path?: string;
          mcp_url?: string | null;
          code_verifier?: string | null;
          discovery_state?: Json | null;
          expires_at?: string;
        };
        Update: {
          return_path?: string;
          mcp_url?: string | null;
          code_verifier?: string | null;
          discovery_state?: Json | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      mcp_oauth_clients: {
        Row: {
          issuer: string;
          client_information: Json;
          updated_at: string;
        };
        Insert: {
          issuer: string;
          client_information: Json;
          updated_at?: string;
        };
        Update: {
          client_information?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      activities: {
        Row: ActivityRow;
        Insert: {
          id?: string;
          athlete_id: string;
          source: string;
          source_activity_id: string;
          sport?: string;
          subsport?: string | null;
          started_at: string;
          duration_seconds?: number | null;
          elapsed_seconds?: number | null;
          moving_seconds?: number | null;
          distance_m?: number | null;
          elevation_m?: number | null;
          avg_hr?: number | null;
          max_hr?: number | null;
          avg_power?: number | null;
          max_power?: number | null;
          normalized_power?: number | null;
          avg_cadence?: number | null;
          avg_speed_mps?: number | null;
          session_type?: string | null;
          session_importance?: string | null;
          rpe?: number | null;
          raw_fit_key?: string | null;
          vendor?: Json | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ActivityRow, "intelligence_eligible">>;
        Relationships: [];
      };
      activity_metrics: {
        Row: {
          activity_id: string;
          potential_load: number | null;
          intensity: number | null;
          aerobic_load: number | null;
          specific_load: number | null;
          hr_zone_seconds: Json | null;
          training_mix: Json | null;
          load_method: string | null;
          data_quality: string | null;
          capabilities: Json | null;
          formula_version: string | null;
          hr_model_max: number | null;
          hr_model_source: string | null;
          hr_model_confidence: string | null;
          hr_z1_max: number | null;
          hr_z2_max: number | null;
          hr_z3_max: number | null;
          hr_z4_max: number | null;
          hr_zone_model_version: string | null;
          threshold_hr: number | null;
          threshold_source: string | null;
          threshold_confidence: string | null;
          zone_method: string | null;
          intensity_classification: string | null;
          intensity_classification_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          activity_id: string;
          potential_load?: number | null;
          intensity?: number | null;
          aerobic_load?: number | null;
          specific_load?: number | null;
          hr_zone_seconds?: Json | null;
          training_mix?: Json | null;
          load_method?: string | null;
          data_quality?: string | null;
          capabilities?: Json | null;
          formula_version?: string | null;
          hr_model_max?: number | null;
          hr_model_source?: string | null;
          hr_model_confidence?: string | null;
          hr_z1_max?: number | null;
          hr_z2_max?: number | null;
          hr_z3_max?: number | null;
          hr_z4_max?: number | null;
          hr_zone_model_version?: string | null;
          threshold_hr?: number | null;
          threshold_source?: string | null;
          threshold_confidence?: string | null;
          zone_method?: string | null;
          intensity_classification?: string | null;
          intensity_classification_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          potential_load?: number | null;
          intensity?: number | null;
          aerobic_load?: number | null;
          specific_load?: number | null;
          hr_zone_seconds?: Json | null;
          training_mix?: Json | null;
          load_method?: string | null;
          data_quality?: string | null;
          capabilities?: Json | null;
          formula_version?: string | null;
          hr_model_max?: number | null;
          hr_model_source?: string | null;
          hr_model_confidence?: string | null;
          hr_z1_max?: number | null;
          hr_z2_max?: number | null;
          hr_z3_max?: number | null;
          hr_z4_max?: number | null;
          hr_zone_model_version?: string | null;
          threshold_hr?: number | null;
          threshold_source?: string | null;
          threshold_confidence?: string | null;
          zone_method?: string | null;
          intensity_classification?: string | null;
          intensity_classification_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_metrics_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: true;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_laps: {
        Row: ActivityLapRow;
        Insert: {
          id?: string;
          activity_id: string;
          athlete_id: string;
          source_index?: number;
          started_at?: string | null;
          duration_seconds?: number | null;
          distance_m?: number | null;
          avg_hr?: number | null;
          avg_power?: number | null;
          created_at?: string;
        };
        Update: Partial<ActivityLapRow>;
        Relationships: [];
      };
      wellness_days: {
        Row: WellnessDayRow;
        Insert: {
          id?: string;
          athlete_id: string;
          date: string;
          resting_hr?: number | null;
          sleep_minutes?: number | null;
          hrv_ms?: number | null;
          stress?: number | null;
          source?: string;
          vendor?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<WellnessDayRow>;
        Relationships: [];
      };
      daily_recovery: {
        Row: DailyRecoveryRow;
        Insert: {
          id?: string;
          athlete_id: string;
          date: string;
          source?: string;
          resting_hr?: number | null;
          sleep_hrv_ms?: number | null;
          sleep_minutes?: number | null;
          sleep_score?: number | null;
          stress_avg?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<DailyRecoveryRow>;
        Relationships: [];
      };
      calendar_items: {
        Row: CalendarItemRow;
        Insert: {
          id?: string;
          athlete_id: string;
          date: string;
          sport?: string;
          title: string;
          intent?: string;
          importance?: string | null;
          planned_seconds?: number | null;
          planned_distance_m?: number | null;
          planned_load?: number | null;
          purpose?: string | null;
          created_by?: string;
          workout?: Json | null;
          notes?: string | null;
          linked_activity_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CalendarItemRow>;
        Relationships: [];
      };
      daily_loads: {
        Row: DailyLoadRow;
        Insert: {
          id?: string;
          athlete_id: string;
          date: string;
          training_load?: number | null;
          fitness?: number | null;
          fatigue?: number | null;
          form?: number | null;
          aerobic_reserve?: number | null;
          specific_capacity?: number | null;
          aerobic_raw?: number | null;
          specific_raw?: number | null;
          acute_fatigue?: number | null;
          development?: number | null;
          potential?: number | null;
          race_readiness?: number | null;
          data_quality?: string | null;
          status?: string | null;
          formula_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<DailyLoadRow>;
        Relationships: [];
      };
      route_clusters: {
        Row: RouteClusterRow;
        Insert: {
          id?: string;
          athlete_id: string;
          sport: string;
          representative_activity_id: string;
          typical_distance_m?: number | null;
          typical_elevation_m?: number | null;
          attempt_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RouteClusterRow>;
        Relationships: [];
      };
      activity_routes: {
        Row: ActivityRouteRow;
        Insert: {
          activity_id: string;
          athlete_id: string;
          sport: string;
          distance_m: number;
          elevation_m?: number | null;
          start_lat: number;
          start_lng: number;
          end_lat: number;
          end_lng: number;
          bbox_min_lat: number;
          bbox_min_lng: number;
          bbox_max_lat: number;
          bbox_max_lng: number;
          points: Json;
          route_cluster_id?: string | null;
          route_similarity?: number | null;
          route_overlap?: number | null;
          direction_match?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ActivityRouteRow>;
        Relationships: [];
      };
      conversations: {
        Row: ConversationRow;
        Insert: {
          id?: string;
          athlete_id: string;
          title?: string | null;
          openai_response_id?: string | null;
          memory_extracted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ConversationRow>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: {
          id?: string;
          conversation_id: string;
          athlete_id: string;
          role: string;
          content?: string;
          proposal?: Json | null;
          proposal_id?: string | null;
          created_at?: string;
        };
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      athlete_memories: {
        Row: AthleteMemoryRow;
        Insert: {
          id?: string;
          athlete_id: string;
          type: string;
          content: string;
          confidence?: number;
          importance?: number;
          source_conversation_id?: string | null;
          created_at?: string;
          updated_at?: string;
          superseded_at?: string | null;
        };
        Update: Partial<AthleteMemoryRow>;
        Relationships: [];
      };
      calendar_proposals: {
        Row: CalendarProposalRow;
        Insert: {
          id?: string;
          athlete_id: string;
          conversation_id?: string | null;
          operations: Json;
          snapshot?: Json;
          rationale?: string;
          status?: string;
          created_at?: string;
          applied_at?: string | null;
          expires_at?: string;
        };
        Update: Partial<CalendarProposalRow>;
        Relationships: [];
      };
      athlete_hr_models: {
        Row: AthleteHrModelRow;
        Insert: {
          id?: string;
          athlete_id: string;
          hr_max: number;
          source: string;
          confidence: string;
          cycling_lthr?: number | null;
          running_lthr?: number | null;
          threshold_source?: string | null;
          threshold_confidence?: string | null;
          valid_from: string;
          valid_to?: string | null;
          provider?: string | null;
          provider_value_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AthleteHrModelRow>;
        Relationships: [];
      };
      activity_session_notes: {
        Row: ActivitySessionNoteRow;
        Insert: {
          activity_id: string;
          athlete_id: string;
          note: Json;
          composed_at?: string;
          updated_at?: string;
        };
        Update: Partial<ActivitySessionNoteRow>;
        Relationships: [];
      };
      coach_reviews: {
        Row: CoachReviewRow;
        Insert: {
          id: string;
          athlete_id: string;
          kind?: string;
          period_start: string;
          period_end: string;
          source?: string | null;
          title: string;
          review: Json;
          created_at?: string;
          completed_at?: string;
          updated_at?: string;
        };
        Update: Partial<CoachReviewRow>;
        Relationships: [];
      };
      agent_actions: {
        Row: AgentActionRow;
        Insert: {
          id?: string;
          athlete_id: string;
          proposal_id?: string | null;
          conversation_id?: string | null;
          operations: Json;
          result?: Json;
          created_at?: string;
          undone_at?: string | null;
        };
        Update: Partial<AgentActionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ai_training_summary: {
        Args: { p_start: string; p_end: string };
        Returns: Json;
      };
      ai_compare_training_periods: {
        Args: { a_start: string; a_end: string; b_start: string; b_end: string };
        Returns: Json;
      };
      ai_current_training_state: {
        Args: { p_date?: string };
        Returns: Json;
      };
      search_athlete_memory: {
        Args: { p_query?: string; p_limit?: number };
        Returns: {
          id: string;
          type: string;
          content: string;
          importance: number;
          confidence: number;
          created_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
};
