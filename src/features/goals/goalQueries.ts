import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Métricas calculadas no banco (private.compute_goal_stats). Números vêm como string/number. */
export interface GoalStats {
  members_goal_base: number
  invites_goal: number
  attendance_goal: number
  guests_unique: number
  present_unique: number
  pct_invites: number | null
  pct_attendance: number | null
  confirmed: number
  online_confirmed: number
  online_registered: number
  online_only: number
  reach_total: number
  need_transport: number
  walk_ins: number
  members_met_invites: number
  members_below_invites: number
  members_met_attendance: number
  members_below_attendance: number
}

export interface ChurchGoal extends GoalStats {
  church_id: string
  church_name: string
}

export interface GroupGoal extends GoalStats {
  group_id: string
  group_name: string
  church_id: string
  church_name: string
  group_active: boolean
}

export interface MemberGoal {
  member_id: string
  full_name: string
  group_id: string
  group_name: string
  church_id: string
  member_active: boolean
  in_goal: boolean
  invites_goal: number
  attendance_goal: number
  invited: number
  present: number
  online: number
  met_invites: boolean
  met_attendance: boolean
}

/** Converte bigint/numeric (texto no PostgREST) em número. */
export function toNumbers<T extends object>(row: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const textKey = /(_id|name)$/.test(k)
    out[k] = !textKey && typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v
  }
  return out as T
}

export function useGoalSummary(
  eventId: string | null | undefined,
  churchId?: string | null,
  groupId?: string | null,
) {
  return useQuery({
    queryKey: ['stats', 'summary', eventId, churchId ?? null, groupId ?? null],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('goal_summary', {
        p_event_id: eventId,
        p_church_id: churchId ?? null,
        p_group_id: groupId ?? null,
      })
      if (error) throw error
      const row = (data as GoalStats[] | null)?.[0]
      return row ? toNumbers(row) : null
    },
  })
}

export function useGoalByChurch(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ['stats', 'by-church', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('goal_by_church', { p_event_id: eventId })
      if (error) throw error
      return ((data ?? []) as ChurchGoal[]).map(toNumbers)
    },
  })
}

export function useGoalByGroup(eventId: string | null | undefined, churchId?: string | null) {
  return useQuery({
    queryKey: ['stats', 'by-group', eventId, churchId ?? null],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('goal_by_group', {
        p_event_id: eventId,
        p_church_id: churchId ?? null,
      })
      if (error) throw error
      return ((data ?? []) as GroupGoal[]).map(toNumbers)
    },
  })
}

export function useMemberGoals(
  eventId: string | null | undefined,
  opts: { groupId?: string | null; memberId?: string | null },
) {
  return useQuery({
    queryKey: ['stats', 'members', eventId, opts.groupId ?? null, opts.memberId ?? null],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('member_goal_stats', {
        p_event_id: eventId,
        p_group_id: opts.groupId ?? null,
        p_member_id: opts.memberId ?? null,
      })
      if (error) throw error
      return ((data ?? []) as MemberGoal[]).map(toNumbers)
    },
  })
}
