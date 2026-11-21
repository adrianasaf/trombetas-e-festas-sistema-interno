export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      assistance_groups: {
        Row: {
          active: boolean
          assistant_leader_name: string | null
          church_id: string
          created_at: string
          id: string
          leader_name: string
          leader_user_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assistant_leader_name?: string | null
          church_id: string
          created_at?: string
          id?: string
          leader_name?: string
          leader_user_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assistant_leader_name?: string | null
          church_id?: string
          created_at?: string
          id?: string
          leader_name?: string
          leader_user_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assistance_groups_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assistance_groups_leader_user_id_fkey'
            columns: ['leader_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      attendances: {
        Row: {
          checked_in_at: string
          checked_in_by: string | null
          client_request_id: string | null
          event_id: string
          guest_id: string
          id: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          type: Database['public']['Enums']['attendance_type']
        }
        Insert: {
          checked_in_at?: string
          checked_in_by?: string | null
          client_request_id?: string | null
          event_id: string
          guest_id: string
          id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          type: Database['public']['Enums']['attendance_type']
        }
        Update: {
          checked_in_at?: string
          checked_in_by?: string | null
          client_request_id?: string | null
          event_id?: string
          guest_id?: string
          id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          type?: Database['public']['Enums']['attendance_type']
        }
        Relationships: [
          {
            foreignKeyName: 'attendances_checked_in_by_fkey'
            columns: ['checked_in_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendances_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendances_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendances_revoked_by_fkey'
            columns: ['revoked_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          church_id: string | null
          created_at: string
          id: number
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          church_id?: string | null
          created_at?: string
          id?: never
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          church_id?: string | null
          created_at?: string
          id?: never
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      churches: {
        Row: {
          active: boolean
          address: string | null
          city: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      duplicate_reviews: {
        Row: {
          candidate_guest_id: string
          church_id: string
          created_at: string
          event_id: string
          guest_id: string
          id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          similarity: number
          status: Database['public']['Enums']['duplicate_status']
        }
        Insert: {
          candidate_guest_id: string
          church_id: string
          created_at?: string
          event_id: string
          guest_id: string
          id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          similarity?: number
          status?: Database['public']['Enums']['duplicate_status']
        }
        Update: {
          candidate_guest_id?: string
          church_id?: string
          created_at?: string
          event_id?: string
          guest_id?: string
          id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          similarity?: number
          status?: Database['public']['Enums']['duplicate_status']
        }
        Relationships: [
          {
            foreignKeyName: 'duplicate_reviews_candidate_guest_id_fkey'
            columns: ['candidate_guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'duplicate_reviews_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'duplicate_reviews_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'duplicate_reviews_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'duplicate_reviews_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      event_settings: {
        Row: {
          anonymized_at: string | null
          anonymized_by: string | null
          checkin_sound_enabled: boolean
          event_id: string
          retention_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anonymized_at?: string | null
          anonymized_by?: string | null
          checkin_sound_enabled?: boolean
          event_id: string
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anonymized_at?: string | null
          anonymized_by?: string | null
          checkin_sound_enabled?: boolean
          event_id?: string
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'event_settings_anonymized_by_fkey'
            columns: ['anonymized_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_settings_event_id_fkey'
            columns: ['event_id']
            isOneToOne: true
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          attendance_goal_per_member: number
          closed_at: string | null
          created_at: string
          cutoff_at: string | null
          id: string
          invites_goal_per_member: number
          location: string | null
          logo_path: string | null
          name: string
          snapshot_taken_at: string | null
          starts_at: string | null
          status: Database['public']['Enums']['event_status']
          stream_url: string | null
          updated_at: string
          year: number
        }
        Insert: {
          attendance_goal_per_member?: number
          closed_at?: string | null
          created_at?: string
          cutoff_at?: string | null
          id?: string
          invites_goal_per_member?: number
          location?: string | null
          logo_path?: string | null
          name: string
          snapshot_taken_at?: string | null
          starts_at?: string | null
          status?: Database['public']['Enums']['event_status']
          stream_url?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          attendance_goal_per_member?: number
          closed_at?: string | null
          created_at?: string
          cutoff_at?: string | null
          id?: string
          invites_goal_per_member?: number
          location?: string | null
          logo_path?: string | null
          name?: string
          snapshot_taken_at?: string | null
          starts_at?: string | null
          status?: Database['public']['Enums']['event_status']
          stream_url?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      goal_snapshots: {
        Row: {
          active: boolean
          church_id: string
          event_id: string
          group_id: string
          id: string
          member_id: string
          taken_at: string
        }
        Insert: {
          active: boolean
          church_id: string
          event_id: string
          group_id: string
          id?: string
          member_id: string
          taken_at?: string
        }
        Update: {
          active?: boolean
          church_id?: string
          event_id?: string
          group_id?: string
          id?: string
          member_id?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'goal_snapshots_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'goal_snapshots_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'goal_snapshots_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'assistance_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'goal_snapshots_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      guest_consents: {
        Row: {
          consent_text: string
          consented_at: string
          given_by_guardian: boolean
          guardian_name: string | null
          guest_id: string
          id: string
          recorded_by: string | null
        }
        Insert: {
          consent_text: string
          consented_at?: string
          given_by_guardian?: boolean
          guardian_name?: string | null
          guest_id: string
          id?: string
          recorded_by?: string | null
        }
        Update: {
          consent_text?: string
          consented_at?: string
          given_by_guardian?: boolean
          guardian_name?: string | null
          guest_id?: string
          id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'guest_consents_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guest_consents_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      guest_referrals: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string | null
          guest_id: string
          id: string
          is_primary: boolean
          member_id: string | null
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          group_id?: string | null
          guest_id: string
          id?: string
          is_primary?: boolean
          member_id?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          group_id?: string | null
          guest_id?: string
          id?: string
          is_primary?: boolean
          member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'guest_referrals_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guest_referrals_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guest_referrals_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guest_referrals_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'assistance_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guest_referrals_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guest_referrals_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      guests: {
        Row: {
          anonymized_at: string | null
          category: Database['public']['Enums']['guest_category']
          church_id: string
          created_at: string
          created_by: string | null
          event_id: string
          full_name: string
          group_id: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          invite_status: Database['public']['Enums']['invite_status']
          is_authority: boolean
          is_other_church_pastor: boolean
          is_walk_in: boolean
          member_id: string | null
          merged_into_id: string | null
          mode: Database['public']['Enums']['participation_mode']
          name_normalized: string | null
          notes: string | null
          phone_normalized: string | null
          possible_duplicate: boolean
          transport: Database['public']['Enums']['transport_need'] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anonymized_at?: string | null
          category: Database['public']['Enums']['guest_category']
          church_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          full_name: string
          group_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          invite_status?: Database['public']['Enums']['invite_status']
          is_authority?: boolean
          is_other_church_pastor?: boolean
          is_walk_in?: boolean
          member_id?: string | null
          merged_into_id?: string | null
          mode?: Database['public']['Enums']['participation_mode']
          name_normalized?: string | null
          notes?: string | null
          phone_normalized?: string | null
          possible_duplicate?: boolean
          transport?: Database['public']['Enums']['transport_need'] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anonymized_at?: string | null
          category?: Database['public']['Enums']['guest_category']
          church_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          full_name?: string
          group_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          invite_status?: Database['public']['Enums']['invite_status']
          is_authority?: boolean
          is_other_church_pastor?: boolean
          is_walk_in?: boolean
          member_id?: string | null
          merged_into_id?: string | null
          mode?: Database['public']['Enums']['participation_mode']
          name_normalized?: string | null
          notes?: string | null
          phone_normalized?: string | null
          possible_duplicate?: boolean
          transport?: Database['public']['Enums']['transport_need'] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'guests_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guests_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guests_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guests_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'assistance_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guests_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guests_merged_into_id_fkey'
            columns: ['merged_into_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'guests_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      member_group_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_church_id: string | null
          from_group_id: string | null
          id: string
          member_id: string
          to_church_id: string
          to_group_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_church_id?: string | null
          from_group_id?: string | null
          id?: string
          member_id: string
          to_church_id: string
          to_group_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_church_id?: string | null
          from_group_id?: string | null
          id?: string
          member_id?: string
          to_church_id?: string
          to_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'member_group_history_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'member_group_history_from_church_id_fkey'
            columns: ['from_church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'member_group_history_from_group_id_fkey'
            columns: ['from_group_id']
            isOneToOne: false
            referencedRelation: 'assistance_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'member_group_history_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'member_group_history_to_church_id_fkey'
            columns: ['to_church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'member_group_history_to_group_id_fkey'
            columns: ['to_group_id']
            isOneToOne: false
            referencedRelation: 'assistance_groups'
            referencedColumns: ['id']
          },
        ]
      }
      members: {
        Row: {
          active: boolean
          church_id: string
          created_at: string
          created_by: string | null
          full_name: string
          group_id: string
          id: string
          inactivated_at: string | null
          joined_at: string
          phone_normalized: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          church_id: string
          created_at?: string
          created_by?: string | null
          full_name: string
          group_id: string
          id?: string
          inactivated_at?: string | null
          joined_at?: string
          phone_normalized?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          church_id?: string
          created_at?: string
          created_by?: string | null
          full_name?: string
          group_id?: string
          id?: string
          inactivated_at?: string | null
          joined_at?: string
          phone_normalized?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'members_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'members_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'members_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'assistance_groups'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_assignments: {
        Row: {
          church_id: string | null
          created_at: string
          created_by: string | null
          group_id: string | null
          id: string
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Update: {
          church_id?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          role?: Database['public']['Enums']['app_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'role_assignments_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'role_assignments_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'role_assignments_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'assistance_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'role_assignments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      transport_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          driver_name: string | null
          event_id: string
          guest_id: string
          id: string
          notes: string | null
          pickup_point: string | null
          status: Database['public']['Enums']['transport_status']
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          driver_name?: string | null
          event_id: string
          guest_id: string
          id?: string
          notes?: string | null
          pickup_point?: string | null
          status?: Database['public']['Enums']['transport_status']
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          driver_name?: string | null
          event_id?: string
          guest_id?: string
          id?: string
          notes?: string | null
          pickup_point?: string | null
          status?: Database['public']['Enums']['transport_status']
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'transport_requests_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transport_requests_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transport_requests_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_event_id: { Args: never; Returns: string }
      bootstrap_polo_admin: { Args: { p_email: string }; Returns: string }
      can_check_in: { Args: never; Returns: boolean }
      can_grant_role: {
        Args: {
          p_church_id: string
          p_group_id: string
          p_role: Database['public']['Enums']['app_role']
        }
        Returns: boolean
      }
      can_manage_user: { Args: { p_user_id: string }; Returns: boolean }
      can_view_polo_stats: { Args: never; Returns: boolean }
      current_profile_id: { Args: never; Returns: string }
      event_is_open: { Args: { p_event_id: string }; Returns: boolean }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      has_any_role: { Args: never; Returns: boolean }
      has_church_access: { Args: { p_church_id: string }; Returns: boolean }
      has_group_access: { Args: { p_group_id: string }; Returns: boolean }
      has_record_access: {
        Args: { p_church_id: string; p_group_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { p_role: Database['public']['Enums']['app_role'] }
        Returns: boolean
      }
      is_polo_admin: { Args: never; Returns: boolean }
      list_manageable_users: {
        Args: never
        Returns: {
          active: boolean
          email: string
          full_name: string
          id: string
          invited_at: string
          last_sign_in_at: string
        }[]
      }
      my_led_group_ids: { Args: never; Returns: string[] }
      my_managed_church_ids: { Args: never; Returns: string[] }
      my_stats_church_ids: { Args: never; Returns: string[] }
      normalize_name: { Args: { p_name: string }; Returns: string }
      normalize_phone: {
        Args: { p_default_ddd?: string; p_input: string }
        Returns: string
      }
      request_ip: { Args: never; Returns: string }
      write_audit: {
        Args: {
          p_action: string
          p_church_id: string
          p_new: Json
          p_old: Json
          p_record_id: string
          p_table: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: 'polo_admin' | 'church_manager' | 'group_leader' | 'reception' | 'reader'
      attendance_type: 'presencial' | 'online'
      duplicate_status: 'pendente' | 'mesclado' | 'pessoas_diferentes'
      event_status: 'planejamento' | 'ativo' | 'encerrado'
      guest_category: 'homem' | 'mulher' | 'crianca' | 'adolescente' | 'jovem_masculino' | 'jovem_feminino'
      invite_status: 'nao_contatado' | 'convidado' | 'confirmou' | 'nao_comparecera'
      participation_mode: 'presencial' | 'online' | 'indefinido'
      transport_need: 'meios_proprios' | 'precisa_transporte' | 'indefinido'
      transport_status: 'pendente' | 'organizado' | 'concluido'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ['polo_admin', 'church_manager', 'group_leader', 'reception', 'reader'],
      attendance_type: ['presencial', 'online'],
      duplicate_status: ['pendente', 'mesclado', 'pessoas_diferentes'],
      event_status: ['planejamento', 'ativo', 'encerrado'],
      guest_category: ['homem', 'mulher', 'crianca', 'adolescente', 'jovem_masculino', 'jovem_feminino'],
      invite_status: ['nao_contatado', 'convidado', 'confirmou', 'nao_comparecera'],
      participation_mode: ['presencial', 'online', 'indefinido'],
      transport_need: ['meios_proprios', 'precisa_transporte', 'indefinido'],
      transport_status: ['pendente', 'organizado', 'concluido'],
    },
  },
} as const
